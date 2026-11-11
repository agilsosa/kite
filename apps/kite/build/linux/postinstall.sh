#!/bin/sh
# Debian postinst and RPM %post for Kite.
#
# The Electron Forge makers install the app payload under /usr/lib/kite. The
# update helper and the polkit rule ship inside the app resources because the
# makers have no hook for arbitrary payload files; this script moves them to
# the fixed system locations that the app and the polkit rule expect.

set -eu

APP_DIR='/usr/lib/kite'
HELPER_SOURCE="$APP_DIR/resources/linux/kite-update"
HELPER_TARGET="$APP_DIR/kite-update"
RULE_SOURCE="$APP_DIR/resources/linux/50-kite-update.rules"
RULE_TARGET='/usr/share/polkit-1/rules.d/50-kite-update.rules'

if [ -f "$HELPER_SOURCE" ]; then
  install -o root -g root -m 0755 "$HELPER_SOURCE" "$HELPER_TARGET"
fi

if [ -f "$RULE_SOURCE" ]; then
  install -d -o root -g root -m 0755 /usr/share/polkit-1/rules.d
  install -o root -g root -m 0644 "$RULE_SOURCE" "$RULE_TARGET"
fi

exit 0
