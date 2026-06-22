#!/usr/bin/env bash
# Verify MXN IVA-inclusive ceil pricing table (catalog net → customer gross).
set -euo pipefail

python3 <<'PY'
import math

IVA = 0.16

def gross_centavos(net_centavos: int) -> int:
    net_major = net_centavos / 100
    return int(math.ceil(net_major * (1 + IVA)) * 100)

cases = [
    ("essentials monthly", 7900, 9200),
    ("essentials yearly", 75900, 88100),
    ("pro monthly", 29900, 34700),
    ("premium monthly", 49900, 57900),
]

fail = 0
for name, net, want in cases:
    got = gross_centavos(net)
    if got != want:
        print(f"FAIL {name}: net={net} want={want} got={got}")
        fail += 1
    else:
        print(f"OK {name}: {net} net → {got} gross (IVA incl.)")

gross_major = 92.0
net_major = round(gross_major / (1 + IVA), 2)
iva_major = round(gross_major - net_major, 2)
if (net_major, iva_major) != (79.31, 12.69):
    print(f"FAIL essentials split: net={net_major} iva={iva_major}")
    fail += 1
else:
    print("OK essentials CFDI split: 79.31 + 12.69 = 92.00")

raise SystemExit(fail)
PY
