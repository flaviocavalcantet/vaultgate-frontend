#!/bin/sh
# Starts the frontend's server (F6): checks the deployment's settings, writes the app's
# runtime configuration and the security headers from them, then runs nginx.
#
#   VAULTGATE_API_URL         the API's public address        https://api.example.com
#   VAULTGATE_GATEWAY_URL     the gateway's public address    https://files.example.com
#   VAULTGATE_OIDC_AUTHORITY  the OpenID Connect issuer       https://sso.example.com/realms/vaultgate
#   VAULTGATE_OIDC_CLIENT_ID  the public client (default vaultgate-web)
#   VAULTGATE_TLS_CERT_FILE   with VAULTGATE_TLS_KEY_FILE: serve HTTPS (TLS 1.3 only)
#                             with this PEM certificate (and chain) and key, reloaded
#                             when they change, checked every
#                             VAULTGATE_TLS_RELOAD_INTERVAL_SECONDS (default 60)
#
# Everything is written under /tmp, so the image runs with a read-only root filesystem.
# A value that isn't a plain http(s) address stops the start: these go into a header
# and a JSON file, and must not be able to add anything to either.
set -eu

out=/tmp/vaultgate
mkdir -p "$out"

fail() {
  echo "vaultgate-frontend: $1" >&2
  exit 1
}

# An http(s) address with no query, fragment, credentials, quotes or spaces; printed
# without a trailing slash.
address() {
  name=$1
  value=$(printenv "$name" || true)
  [ -n "$value" ] || fail "$name is not set"
  printf '%s' "$value" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$' ||
    fail "$name is not an http(s) address: $value"
  printf '%s' "${value%/}"
}

# scheme://host[:port] of an address, for the Content-Security-Policy.
origin() {
  printf '%s' "$1" | sed -E 's#^(https?://[^/]+).*#\1#'
}

api=$(address VAULTGATE_API_URL)
gateway=$(address VAULTGATE_GATEWAY_URL)
authority=$(address VAULTGATE_OIDC_AUTHORITY)
client=${VAULTGATE_OIDC_CLIENT_ID:-vaultgate-web}
printf '%s' "$client" | grep -Eq '^[A-Za-z0-9._-]{1,64}$' ||
  fail "VAULTGATE_OIDC_CLIENT_ID is not a client ID: $client"

cat >"$out/config.json" <<JSON
{
  "apiUrl": "$api",
  "gatewayUrl": "$gateway",
  "oidc": { "authority": "$authority", "clientId": "$client" }
}
JSON

# The app's own files only; the API, the gateway (uploads by fetch, downloads by form)
# and the identity provider (discovery and tokens) by name; no inline code, no frames,
# no plugins.
csp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'"
csp="$csp; connect-src 'self' $(origin "$api") $(origin "$gateway") $(origin "$authority")"
csp="$csp; form-action $(origin "$gateway"); base-uri 'none'; frame-ancestors 'none'"
csp="$csp; object-src 'none'; manifest-src 'self'"

cat >"$out/headers.conf" <<CONF
add_header Content-Security-Policy "$csp" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
CONF

# TLS (VaultGate's M9: TLS on every hop). The JavaScript this serves holds the user's
# tokens, so it must reach the browser unaltered even inside a cluster's network.
cert=${VAULTGATE_TLS_CERT_FILE:-}
key=${VAULTGATE_TLS_KEY_FILE:-}
if [ -n "$cert$key" ]; then
  [ -n "$cert" ] && [ -n "$key" ] || fail "set both VAULTGATE_TLS_CERT_FILE and VAULTGATE_TLS_KEY_FILE, or neither"
  [ -r "$cert" ] && [ -r "$key" ] || fail "the TLS certificate or key can't be read"
  cat >"$out/listen.conf" <<CONF
listen 8080 ssl;
ssl_certificate $cert;
ssl_certificate_key $key;
ssl_protocols TLSv1.3;
ssl_session_tickets off;
CONF
  echo 'add_header Strict-Transport-Security "max-age=63072000" always;' >>"$out/headers.conf"
  scheme=https
else
  echo 'listen 8080;' >"$out/listen.conf"
  scheme=http
fi

echo "vaultgate-frontend: $scheme on 8080; API $api, gateway $gateway, identity provider $authority"
if [ "$scheme" = http ]; then
  exec nginx -g 'daemon off;'
fi

# With TLS, this shell stays as PID 1: it runs nginx, reloads it when the certificate
# or key changes (cert-manager renews them in place), and passes a stop on to it.
fingerprint() { cat "$cert" "$key" 2>/dev/null | md5sum; }
interval=${VAULTGATE_TLS_RELOAD_INTERVAL_SECONDS:-60}
case $interval in '' | *[!0-9]* | 0) fail "VAULTGATE_TLS_RELOAD_INTERVAL_SECONDS must be a positive number" ;; esac

nginx -g 'daemon off;' &
nginx_pid=$!
trap 'kill -QUIT "$nginx_pid" 2>/dev/null; wait "$nginx_pid"; exit 0' TERM INT QUIT
seen=$(fingerprint)
while kill -0 "$nginx_pid" 2>/dev/null; do
  sleep "$interval" &
  wait $! || true
  now=$(fingerprint)
  if [ "$now" != "$seen" ]; then
    # A renewal can land as two writes: only a pair nginx accepts is loaded.
    if nginx -t -q 2>/dev/null; then
      nginx -s reload && seen=$now && echo "vaultgate-frontend: reloaded the renewed certificate"
    fi
  fi
done
wait "$nginx_pid"
