#!/usr/bin/env python3
"""Generate supabase/import_costings.sql from the workbook transcription.

Full-fidelity import of Tenn_MindHome_EE_TFM_ALC Status.xlsx (Drive copy,
modified 11 Jun 2026): every cost column (bank charges, salesman comms, etc.)
becomes its own cost line matching the category template labels, sharing
columns become % shares of gross profit, suppliers/remarks go into notes.
"""
import json

# Each row: (cash_sale_no, customer, revenue, {cost label: amount}, [(share name, pct)], status, notes)
SHEETS: list[tuple[str, list]] = []

# ---- Mindhome / Reno -------------------------------------------------------
# Workbook columns: BANK INSTALLMENT COST CHARGES, BANK CHARGES, COMM BAL,
# SALESMAN COMM (w/c/l/g), SALESMAN COMM (angel/sally), SALESMAN COMM (CZX/GES),
# MATERIAL COSTING. OTHER SHARING = 50% of GP; SHARING (CZX & GES) = 10%.
BI, BC, CB = 'Bank Installment Charges', 'Bank Charges', 'Comm Bal'
S1, S2, S3 = 'Salesman Comm (w/c/l/g)', 'Salesman Comm (angel/sally)', 'Salesman Comm (CZX/GES)'
M = 'Material Costing'
OTH = ('Other Sharing', 50)
CZG = ('CZX & GES', 10)
SHEETS.append(('reno', [
    ('CS2605/012', 'AG15-WAYNE — 2 Room Premium', 23444, {BI: 2144.40, BC: 39.00, S1: 900, M: 12149.18}, [OTH, CZG], 'Collecting Money', '29/5 settling'),
    ('CS2605/013', 'AG16-WAYNE — 2 Room Premium', 23444, {BI: 2144.00, BC: 39.00, S1: 900, M: 11870.31}, [OTH, CZG], 'Completed', 'Left backend'),
    ('CS2604/203 8/5/2026', 'A-03-02-TSL — 2 Room Customize', 29999, {S1: 350, S2: 175, S3: 375, M: 10838.10}, [OTH, CZG], 'Completed', ''),
    ('CS2604/134', 'A-08-10-WAYNE — 2 Room Customize', 1199, {S1: 250, M: 718.53}, [OTH, CZG], 'Completed', ''),
    ('CS2604/202 8/5/26', 'A-10-01-GES — 2 Room Customize', 10238, {BC: 98.51, S1: 467, S2: 100, S3: 333, M: 5348.56}, [OTH, CZG], 'Completed', ''),
    ('CS2605/061', 'D-02-32-CHAI — 2 Room Standard', 19999, {BC: 1139.00, S1: 900, M: 9224.53}, [], 'Completed', '9 Jun Done Payment'),
    ('CS2605/123', 'A-08-32-WAYNE — 2 Room Premium (excl 旋转桌)', 21499, {BI: 1949.90, BC: 39.00, S1: 900, M: 11352.06}, [OTH, CZG], 'Completed', ''),
    ('CS2605/194', 'B-12-08-CHAI — 3 Room Premium add-on 厨房吊柜', 30699, {BC: 160.00, S1: 1000, M: 12713.41}, [OTH, CZG], 'Completed', ''),
    ('', 'A-09-15 BCY — Black Dry Kitchen Cabinet set', 9599, {BC: 735.29, M: 4123.63}, [], 'Completed', ''),
    ('', 'B-03-07 WAYNE — 3 Room Premium 餐边柜 change 厨房吊柜', 29999, {S1: 1000}, [], 'Collecting Money', '29/5 settling'),
    ('', 'C-03-09 BILLY — 3 Room Premium', 36999, {CB: 550, S1: 1000, S2: 200}, [], 'Installing', '2 June install'),
    ('', 'C-05-02 CZX — 3 Room Premium', 29999, {BC: 160, S1: 1000}, [], 'Installing', 'done by 29 June'),
    ('', 'E-12-05-GES — 3 Room Premium 餐边柜+玄关柜 change to 厨房对面柜', 29999, {BC: 39, S1: 1000}, [], 'In Progress', '开着料'),
    ('', 'D-G-16 WAYNE — 2 Room Standard', 19999, {BC: 50, S1: 900}, [], 'In Progress', '开着料'),
    ('', 'D-03-26-GES — 2 Room Premium (excl 厨房柜)', 21000, {BC: 349, S1: 900}, [], 'In Progress', '开着料'),
    ('', 'A-10-06-GES — 2 Room Standard', 19999, {S1: 750, S2: 150}, [], 'In Progress', ''),
    ('', 'A-11-13-WAYNE — 2 Room Standard', 18500, {BC: 1039.00}, [], 'In Progress', ''),
    ('', 'B-03A-01 WAYNE — 3 Room Premium', 29999, {BC: 10, S1: 1000}, [], 'In Progress', ''),
    ('', 'B-03-05 WAYNE — 3 Room Premium', 29999, {BC: 10, S1: 1000}, [], 'In Progress', ''),
    ('', 'D-07-13 WAYNE — 2 Room Standard', 19999, {BC: 10, S1: 900}, [], 'In Progress', ''),
    ('', 'D-12-11-CHAI — 2 Room Premium', 24999, {BC: 90, S1: 900}, [], 'In Progress', ''),
    ('', 'B-12-02-GES — 3 Room Premium Masterroom + second bedroom, foyer and tv', 16000, {S1: 900}, [], 'Chatting', ''),
    ('', 'B-11-07-CZX', 30999, {S1: 1000}, [], 'Chatting', ''),
]))

# ---- Smart Home ------------------------------------------------------------
BInt, SC, OC = 'Bank Interest', 'Salesman Comm', 'Overriding Comm'
PSH = ('P.Sharing', 50)
SHEETS.append(('smarthome', [
    ('CS2604/008-KKIC 19/5/2026', 'B-08-07 — Smart Home', 6000, {M: 1955.38, SC: 300, OC: 120}, [PSH], 'Completed', 'Full Cash · comm release 20/5/2026'),
    ('CS2602/005-B 19/5/2026', 'C-01-02 — Smart Home', 6039, {BInt: 594.00, M: 1326.41, SC: 300, OC: 120.78}, [PSH], 'Installing', '99+(5940) 24 months installment · comm release 20/5/2026'),
    ('CS2604/006-CZX', 'B-12-08 — Smart Home', 5888, {M: 3159.75, OC: 117.76}, [PSH], 'Installing', '50% cash payment only · comm release 20/5/2026'),
    ('CS2604/007-CZX', 'C-05-02 — Smart Home', 5388, {M: 1694.36, OC: 107.76}, [PSH], 'Installing', 'Full Cash · comm release 20/5/2026'),
    ('', 'A-11-03 — Smart Home', 6039, {BInt: 592.81}, [], 'Completed', '99+(5940) 36 months installment'),
    ('', 'C-03-09 — Smart Home', 5888, {}, [], 'Installing', 'Pay from Tenn Mindhome'),
    ('', 'E-07-03A — Smart Home', 6039, {BInt: 594.00}, [], 'In Progress', '99 (planning installment)'),
    ('', 'C-08-09 — Smart Home', 6039, {}, [], 'Chatting', 'No contact yet · 3/6 receive payment'),
]))

# ---- Smart Lock -------------------------------------------------------------
BK, DEV, INS, LALA, SL3 = 'Bank Comm', 'Device Costing', 'Installation', 'Lalamove', 'Salesman Comm (3%)'
SHEETS.append(('smartlock', [
    ('CS2602/002-GES', 'A-08-33A — Standard Smart Lock', 1549, {DEV: 240, INS: 150, SL3: 30.98}, [PSH], 'Completed', ''),
    ('CS2604/004-LSL', 'D-05-23A — Premium Smart Lock', 2149, {DEV: 500, INS: 180, LALA: 128.90, SL3: 64.47}, [PSH], 'Completed', ''),
    ('CS2605/001-BCY', 'D-07-23 — Premium Smart Lock', 2149, {DEV: 500, INS: 180}, [], 'Completed', ''),
    ('', 'C-05-02 — Premium Smart Lock', 1979, {DEV: 500}, [], 'In Progress', 'After finish Reno · grey (stock)'),
    ('CS2512/003-BCY', 'A-05-03 — Premium Smart Lock', 2149, {DEV: 500, SL3: 64.47}, [PSH], 'In Progress', 'After finish Reno · black (order)'),
    ('', 'A-10-06 — Premium Smart Lock', 2149, {DEV: 500}, [], 'In Progress', 'After finish Reno · black (stock)'),
    ('', 'A-07-06 — Standard Smart Lock', 1549, {DEV: 240}, [], 'In Progress', 'After finish Reno · normal (stock)'),
    ('', 'B-12-08 — Premium Smart Lock', 1899, {DEV: 500}, [], 'In Progress', 'After finish Reno · black (order)'),
    ('', 'B-08-07 — Premium Smart Lock', 2000, {}, [], 'Collecting Money', 'Planning install · black (stock)'),
    ('CS2605/002', 'A-11-03 — Premium Smart Lock', 1979, {BK: 19.79, DEV: 500, INS: 250, SL3: 59.37}, [], 'Completed', 'Black (stock)'),
]))

# ---- Aluminium Cabinet ------------------------------------------------------
CAB, SINK = 'Cabinet Costing', 'Sink & Paip'
SP = 'Cabinet: Classic Home · Sink & Paip: Tenn Fasteners'
SHEETS.append(('alucab', [
    ('CS2604/075 8/5/2026', 'A-10-01 — Small Yard Aluminium Cabinet', 2499, {CAB: 1600}, [], 'Completed', 'Supplier: Classic Home'),
    ('CS2603/166 8/5/26', 'D-08-26 — Dry Kitchen table top 6ft cabinet', 6500, {CAB: 3250, SINK: 250}, [], 'Completed', SP),
    ('CS2604/076 8/5/26', 'C-13-12 — Dry Kitchen table top 7ft cabinet', 7000, {CAB: 3500, SINK: 250}, [], 'Completed', SP),
    ('', 'A-10-06 — Plaster Ceiling', 4500, {CAB: 2800}, [], 'Completed', 'Supplier: Classic Home'),
    ('', 'A-07-06 — Dry and Yard Kitchen Cabinet', 11888, {CAB: 8560, SINK: 250}, [], 'Installing', SP + ' · Ask Lee Qing for date install · passed key to them ard'),
    ('', 'E-12-05 — Shoes Cabinet', 4000, {CAB: 2300}, [], 'Completed', 'Supplier: Classic Home · Ask Lee Qing for date install'),
    ('', 'A-12-08 — Dry and Yard Kitchen Cabinet', 11888, {CAB: 8090, SINK: 250}, [], 'Installing', SP + ' · Waiting owner pass gas stove to office'),
    ('', 'B-12-02 — Dry Kitchen Cabinet', 12000, {SINK: 250}, [], 'Chatting', SP),
    ('', 'B-11-07', 6000, {SINK: 500}, [], 'Chatting', ''),
]))

# ---- EE ---------------------------------------------------------------------
C = 'Costing'
SHEETS.append(('ee', [
    ('CS2605/043 8/5/26', 'A-10-06 — EE', 2490, {C: 1605}, [], 'Completed', 'Supplier: Seng'),
    ('CS2603/071 / CS2603/138 8/5/26', 'C-13-12 — EE', 3200, {C: 2449}, [], 'Completed', 'Supplier: Seng'),
    ('CS2603/091 8/5/26', 'D-01-32 — EE', 400, {C: 316}, [], 'Completed', 'Supplier: Seng'),
    ('CS2602/065 8/5/26', 'C-01-02 — EE', 900, {C: 750}, [], 'Completed', 'Supplier: Kwan · Due to high profit in Smart Home so price lower'),
    ('CS2605/046 8/5/26', 'C-03-09 — EE', 4700, {C: 3500}, [], 'Completed', 'Supplier: Kwan'),
    ('CS2604/177 8/5/2026', 'C-05-02 — EE', 5500, {C: 4000}, [], 'Completed', 'Supplier: Kwan'),
    ('CS2605/044 8/5/2026', 'E-12-05 — EE', 6450, {C: 4685}, [], 'Completed', 'Supplier: Kang'),
    ('CS2605/047 8/5/26', 'D-03-26 — EE', 4340, {C: 2760}, [], 'Collecting Money', 'Supplier: Kang · Collected 80%'),
    ('', 'B-12-08 — Change Plug Location', 0, {C: 250}, [], 'Completed', 'Supplier: Kang · charge Mindhome costing'),
    ('CS2605/182 25/5/2026', 'A-07-06 — EE', 815, {C: 530}, [], 'Completed', 'Supplier: Kang'),
    ('CS2605/084 14/5/2026', 'A-10-06 — EE', 672, {C: 360}, [], 'Completed', 'Supplier: Kang'),
]))

# ---- Products ---------------------------------------------------------------
# The unnamed column next to CS No is a 20% sharing of gross profit
# (39.00 = 20% of 195, 271.60 = 20% of 1358, …).
SH20 = ('Sharing', 20)
SHEETS.append(('product', [
    ('CS2602/117', 'A-03-02 — Products', 7020, {C: 5271}, [], 'Completed', 'Supplier: Teck Trading'),
    ('CS2605/047', 'D-03-26 — Products', 780, {C: 640}, [], 'Completed', 'Supplier: Teck Trading'),
    ('CS2605/084 14/5/26', 'A-10-06 — Products', 1820, {C: 1424}, [], 'Completed', 'Supplier: Teck Trading'),
    ('CS2606/018', 'E-12-05 — Products', 995, {C: 800}, [SH20], 'Completed', 'Supplier: Teck Trading'),
    ('', 'D-03-26 — Products', 5380, {C: 4225}, [], 'Collecting Money', 'Supplier: Teck Trading · 28/5/2026 install'),
    ('CS2605/043 08/5/26', 'A-10-06 — Products', 5010, {C: 3907}, [], 'In Progress', 'Supplier: Teck Trading · 28/5/2026 install'),
    ('CS2606/018', 'E-12-05 — Products', 6040, {C: 4682}, [SH20], 'Completed', 'Supplier: Teck Trading · 28/5/2026 install'),
    ('CS2605/084 14/5/26', 'A-10-06 — Lighting', 322, {C: 174.30}, [], 'Completed', 'Supplier: Tyng Lighning'),
    ('CS2606/018', 'E-12-05 — Lighting', 430, {C: 242.30}, [SH20], 'Completed', 'Supplier: Tyng Lighning'),
    ('', 'D-03-26 — INS AC', 1500, {C: 780}, [], 'Collecting Money', 'Supplier: Ah Yong · 28/5/2026 install'),
    ('CS2605/043', 'A-10-06 — INS AC', 1500, {C: 795}, [], 'Completed', 'Supplier: Ah Yong · 28/5/2026 install'),
    ('CS2606/018', 'E-12-05 — INS AC', 2000, {C: 1134}, [SH20], 'Completed', 'Supplier: Ah Yong · 28/5/2026 install'),
    ('CS2606/018', 'E-12-05 — LIVINOX', 3088, {C: 2535.65}, [SH20], 'Installing', 'Supplier: LIVINOX · Waiting MindHome cabinet tgt'),
    ('CS2605/084 14/05/26', 'A-10-06 — LIVINOX', 550, {C: 372}, [], 'Completed', 'Supplier: LIVINOX'),
    ('CS2604/203', 'A-03-02 — LIVINOX', 1830, {C: 1477.75}, [], 'Completed', 'Supplier: LIVINOX'),
]))


def esc(s: str) -> str:
    return s.replace("'", "''")


lines = [
    '-- ============================================================================',
    '--  Full import of costings from Tenn_MindHome_EE_TFM_ALC Status.xlsx',
    '--  (Drive copy modified 11 Jun 2026). Every workbook cost column becomes its',
    '--  own cost line (bank charges, salesman comms, etc.) so the spreadsheet view',
    '--  shows the same columns as the original. Sharing columns are stored as % of',
    '--  gross profit (Mindhome: Other Sharing 50% + CZX & GES 10%; Smart Home /',
    '--  Smart Lock: P.Sharing 50%; Products: Sharing 20%). Suppliers and remarks',
    '--  are in notes. Boss-only table; run in the SQL Editor (service role).',
    '-- ============================================================================',
    '',
    '-- Reimport: clears the table first, then inserts (removes ALL costings,',
    '-- including any added/edited by hand).',
    'delete from public.costings;',
    '',
]

total = 0
for category, rows in SHEETS:
    lines.append(f'-- ---- {category} ({len(rows)} rows) ----')
    for cs, customer, revenue, costs, shares, status, notes in rows:
        costs_j = json.dumps([{'label': k, 'amount': v} for k, v in costs.items()], ensure_ascii=False)
        shares_j = json.dumps([{'name': n, 'percent': p} for n, p in shares], ensure_ascii=False)
        # Staggered created_at keeps a stable workbook order (the app lists
        # newest first, so the first workbook row gets the latest timestamp).
        lines.append(
            'insert into public.costings (cash_sale_no, category, customer, revenue, costs, commissions, shares, status, notes, created_at) '
            f"values ('{esc(cs)}','{category}','{esc(customer)}',{revenue},"
            f"'{esc(costs_j)}'::jsonb,'[]'::jsonb,'{esc(shares_j)}'::jsonb,'{status}','{esc(notes)}',"
            f"now() - interval '{total} minutes');"
        )
        total += 1
    lines.append('')

lines.append(f'-- {total} rows imported.')
with open('supabase/import_costings.sql', 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f'wrote supabase/import_costings.sql with {total} rows')
