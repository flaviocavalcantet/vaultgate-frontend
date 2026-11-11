#!/bin/sh
# Starts the frontend's server (F6): checks the deployment's settings, writes the app's
# runtime configuration and the security headers from them, then runs nginx.
#
#   VAULTGATE_API_URL         the API's public address        https://api.example.com
#   VAULTGATE_GATEWAY_URL     the gateway's public address    https://files.example.com
#   VAULTGATE_OIDC_AUTHORITY  the OpenID Connect issuer       https://sso.example.com/realms/vaultgate
#   VAULTGATE_OIDC_CLIENT_ID  the public client (default vaultgate-web)
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

echo "vaultgate-frontend: API $api, gateway $gateway, identity provider $authority"
exec nginx -g 'daemon off;'
