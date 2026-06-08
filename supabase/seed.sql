-- Seed: import from Tenn_MindHome_EE_TFM_ALC status sheet.
-- Re-runnable: clears previously imported rows first.
-- Run in Supabase SQL Editor after schema.sql.

alter table public.jobs alter column stage set default 'booked';

delete from public.jobs where updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-03-02', '2 Room Customize', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: TSL', 'Import' from public.jobs where customer_name = 'A-03-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — CS2604/203 8/5/2026', 'Import' from public.jobs where customer_name = 'A-03-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Products — Completed', 'Import' from public.jobs where customer_name = 'A-03-02' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-05-03', 'Smart Lock', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, Black (order), after finish reno — In Progress', 'Import' from public.jobs where customer_name = 'A-05-03' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-07-06', 'Aluminium + Smart Lock + Electrical', 'in_progress', 'Owner (key passed)', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Standard, Normal (stock), after finish reno — In Progress', 'Import' from public.jobs where customer_name = 'A-07-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Dry & Yard Kitchen Cabinet · KEY PASSED TO OWNER — Installing', 'Import' from public.jobs where customer_name = 'A-07-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'A-07-06' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-08-10', '2 Room Customize', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'A-08-10' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — CS2604/134', 'Import' from public.jobs where customer_name = 'A-08-10' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-08-32', '2 Room Premium (exclude 旋转桌)', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'A-08-32' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — CS2605/123', 'Import' from public.jobs where customer_name = 'A-08-32' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-08-33A', 'Smart Lock', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Standard — Completed', 'Import' from public.jobs where customer_name = 'A-08-33A' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-09-15', 'Black Dry Kitchen Cabinet set', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: BCY', 'Import' from public.jobs where customer_name = 'A-09-15' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-10-01', '2 Room Customize', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: GES', 'Import' from public.jobs where customer_name = 'A-10-01' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — CS2604/202 8/5/26', 'Import' from public.jobs where customer_name = 'A-10-01' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Small Yard Cabinet — Completed', 'Import' from public.jobs where customer_name = 'A-10-01' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-10-06', '2 Room Standard', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: GES', 'Import' from public.jobs where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, Black (stock), after finish reno — In Progress', 'Import' from public.jobs where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Plaster Ceiling — Completed', 'Import' from public.jobs where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Products — fans, AC, Livinox (install 28/5) — In Progress', 'Import' from public.jobs where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-11-13', '2 Room Standard', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'A-11-13' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — 99+(5940) 36-month installment — Completed', 'Import' from public.jobs where customer_name = 'A-11-13' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, Black (stock) — Completed', 'Import' from public.jobs where customer_name = 'A-11-13' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('A-12-08', 'Aluminium Cabinet', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Dry & Yard Kitchen Cabinet, waiting owner to pass gas stove — In Progress', 'Import' from public.jobs where customer_name = 'A-12-08' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('AG15', '2 Room Premium', 'installing', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'AG15' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 29/5 settling · CS2605/012', 'Import' from public.jobs where customer_name = 'AG15' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('AG16', '2 Room Premium', 'installing', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'AG16' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — Left backend · CS2605/013', 'Import' from public.jobs where customer_name = 'AG16' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-03-05', '3 Room Premium', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'B-03-05' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-03-07', '3 Room Premium (餐边柜 change 厨房吊柜)', 'collecting', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'B-03-07' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 29/5 settling', 'Import' from public.jobs where customer_name = 'B-03-07' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-03A-01', '3 Room Premium', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'B-03A-01' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-08-07', 'Smart Home + Smart Lock', 'collecting', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — Full cash — Completed', 'Import' from public.jobs where customer_name = 'B-08-07' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, Black (stock), planning install — Collecting Money', 'Import' from public.jobs where customer_name = 'B-08-07' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-11-07', '3 Room Premium', 'booked', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: CZX', 'Import' from public.jobs where customer_name = 'B-11-07' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-12-02', '3 Room Premium (Masterroom, 2nd bedroom, foyer & tv)', 'booked', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: GES', 'Import' from public.jobs where customer_name = 'B-12-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Dry Kitchen Cabinet — Booked', 'Import' from public.jobs where customer_name = 'B-12-02' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('B-12-08', '3 Room Premium add-on 厨房吊柜', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: CHAI', 'Import' from public.jobs where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — CS2605/194', 'Import' from public.jobs where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — 50% cash payment only — Installing', 'Import' from public.jobs where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, Black (order), after finish reno — In Progress', 'Import' from public.jobs where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — change plug location — In Progress', 'Import' from public.jobs where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('C-01-02', 'Smart Home + Electrical', 'installing', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — 99+(5940) 24-month installment — Installing', 'Import' from public.jobs where customer_name = 'C-01-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'C-01-02' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('C-03-09', '3 Room Premium', 'installing', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: BILLY', 'Import' from public.jobs where customer_name = 'C-03-09' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 2 June install', 'Import' from public.jobs where customer_name = 'C-03-09' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — Pay from Tenn Mindhome — Installing', 'Import' from public.jobs where customer_name = 'C-03-09' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'C-03-09' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('C-05-02', '3 Room Premium', 'installing', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: CZX', 'Import' from public.jobs where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — Done by 29 June', 'Import' from public.jobs where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — Installing', 'Import' from public.jobs where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium, grey (stock), after finish reno — In Progress', 'Import' from public.jobs where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('C-08-09', 'Smart Home', 'booked', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — 3/6 receive payment — Booked', 'Import' from public.jobs where customer_name = 'C-08-09' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('C-13-12', 'Aluminium + Electrical', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Dry Kitchen table top 7ft cabinet — Completed', 'Import' from public.jobs where customer_name = 'C-13-12' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'C-13-12' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-01-32', 'Electrical', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'D-01-32' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-02-32', '2 Room Standard', 'collecting', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: CHAI', 'Import' from public.jobs where customer_name = 'D-02-32' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 9 Jun payment · CS2605/061', 'Import' from public.jobs where customer_name = 'D-02-32' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-03-26', '2 Room Premium (exclude 厨房柜)', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: GES', 'Import' from public.jobs where customer_name = 'D-03-26' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 开着料', 'Import' from public.jobs where customer_name = 'D-03-26' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — collected 80% — Collecting Money', 'Import' from public.jobs where customer_name = 'D-03-26' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Products — AC install 28/5 — Collecting Money', 'Import' from public.jobs where customer_name = 'D-03-26' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-05-23A', 'Smart Lock', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium — Completed', 'Import' from public.jobs where customer_name = 'D-05-23A' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-07-13', '2 Room Standard', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'D-07-13' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-07-23', 'Smart Lock', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Lock — Premium — Completed', 'Import' from public.jobs where customer_name = 'D-07-23' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-08-26', 'Aluminium Cabinet', 'completed', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Dry Kitchen table top 6ft cabinet — Completed', 'Import' from public.jobs where customer_name = 'D-08-26' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-12-11', '2 Room Premium', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: CHAI', 'Import' from public.jobs where customer_name = 'D-12-11' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('D-G-16', '2 Room Standard', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: WAYNE', 'Import' from public.jobs where customer_name = 'D-G-16' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 开着料', 'Import' from public.jobs where customer_name = 'D-G-16' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('E-07-03A', 'Smart Home', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Smart Home — 99 (planning installment) — In Progress', 'Import' from public.jobs where customer_name = 'E-07-03A' and updated_by = 'Spreadsheet import';

insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ('E-12-05', '3 Room Premium (餐边柜+玄关柜 change 厨房对面柜)', 'in_progress', 'Office', 'Spreadsheet import');
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Salesman: GES', 'Import' from public.jobs where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Mindhome — 开着料', 'Import' from public.jobs where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Aluminium — Shoes Cabinet — Completed', 'Import' from public.jobs where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'EE / Electrical — Completed', 'Import' from public.jobs where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
insert into public.job_events (job_id, type, body, author_name) select id, 'note', 'Products — fans, AC, Livinox (install 28/5) — Installing', 'Import' from public.jobs where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
