#!/bin/sh
# Debian postrm and RPM %postun for Kite.
#
# $1 is "remove"/"purge" on Debian and the number of remaining packages on RPM.
# An upgrade passes "upgrade ..." or a positive number, so the helper and the
# polkit rule are only removed when Kite is actually uninstalled.

set -eu

case "${1:-}" in
  remove | purge | 0)
    rm -f \
      /usr/lib/kite/kite-update \
      /usr/share/polkit-1/rules.d/50-kite-update.rules
    ;;
esac

exit 0
