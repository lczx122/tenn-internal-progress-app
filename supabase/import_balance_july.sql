-- ============================================================================
--  Import: Iron / Painting / Aluminium balance work (July snapshot 01/07/26)
-- ----------------------------------------------------------------------------
--  Supersedes import_iron_painting_alum.sql. Correct per-trade categories
--  (Iron Work / Painting / Aluminium Work), sets each unit's per-trade order
--  amount (order_by_category) + a per-trade deposit under Collection, assigns
--  PIC from the Ref initials, and a work card per trade. Matches existing units
--  by unit code. Cancelled rows are excluded. SAFE TO RE-RUN.
-- ============================================================================
begin;

-- 0) remove the artifacts of the previous import so this one is authoritative
delete from public.job_works where updated_by in ('Import 31/05/26','Import 01/07/26') or remarks like 'Imported:%';
delete from public.claims    where note like 'Imported deposit%';

create temporary table _imp (
  unit_code text, customer text, trade text, amount numeric, deposit numeric,
  installed boolean, so_no text, ref text, detail text
) on commit drop;
insert into _imp (unit_code, customer, trade, amount, deposit, installed, so_no, ref, detail) values
  ('A-03A-10','FATHUL FAQIHIN BIN AZMAN','Iron Work',800.00,600.00,false,'SO2601/022','CYM','IW (C6)'),
  ('A-06-05','NG KIM CHAI','Iron Work',2900.00,200.00,false,'SO2601/030','WCSH','IW'),
  ('A-06-36','LEE YUN KIAN CHAN YIT FERN','Iron Work',800.00,200.00,false,'SO2601/038','CYM','IW'),
  ('A-07-31','ZURINAH BINTI MAT CHALIT','Iron Work',2100.00,200.00,false,'SO2601/042','LSL','IW'),
  ('A-08-31','LIM YEE LIANG','Iron Work',1900.00,1150.00,false,'SO2601/048','WCSH','IW (C4)'),
  ('B-01-02','NUR ADILAH BINTI MOHAMMAD AZHAR','Iron Work',3300.00,1850.00,false,'SO2601/099','JL','IW (C6)'),
  ('B-13A-09','VIVEKANANTHAN A/L SUBRAMANIAM','Iron Work',4200.00,2300.00,false,'SO2601/130','WCSH','IW (C6)'),
  ('A-07-07','NG YONG CHUAN','Iron Work',800.00,800.00,false,'SO2601/134','JL','IW (C5)*'),
  ('C-07-03A','KUMARESAN A/L SIVALINGAM','Iron Work',4200.00,2300.00,false,'SO2601/142','WCSH','IW (C7)'),
  ('C-07-06','SHARVIN A/L N.VIVEKANANDAN EURAJ A/L N. VIVEKANANDAN','Iron Work',4200.00,200.00,false,'SO2601/143','WCSH','IW'),
  ('C-07-07','PUVENDRA A/L AHCHUTAN','Iron Work',900.00,650.00,false,'SO2601/144','LSL','IW (C7)'),
  ('C-07-11','AGNES SEOW CHEN CHI','Iron Work',1500.00,1000.00,false,'SO2601/145','TSL','IW (C5)'),
  ('C-08-10','KOH HOW LUEN','Iron Work',2400.00,1400.00,false,'SO2601/148','OPL','IW (C6)'),
  ('D-03-12','MUHAMMAD MUTHAWAKIL BIN HJ SHADIK MOHAMED','Iron Work',2900.00,200.00,false,'SO2601/169','WCSH','IW'),
  ('D-06-08','AHMAD TAUFIK BIN ABD GHAPAR','Iron Work',2900.00,200.00,false,'SO2601/173','WCSH','IW'),
  ('D-06-15','MARIATI BINTI CHE OMAR','Iron Work',2900.00,200.00,false,'SO2601/174','WCSH','IW'),
  ('D-06-38','AINUDIN BIN AFANDI','Iron Work',2900.00,200.00,false,'SO2601/178','KKC','IW'),
  ('D-07-09','NUUR ASHIQIN BINTI ROHAIDI','Iron Work',1750.00,1075.00,false,'SO2601/179','BCY','IW / IG (C7)'),
  ('D-09-11','CHANTHIRAN A/L TANIMALEY','Iron Work',2900.00,1650.00,false,'SO2601/184','WCSH','IW'),
  ('D-10-36','KELLY NATASYA MAHANI BINTI MAFAR','Iron Work',800.00,400.00,false,'SO2601/190','KKC','IW'),
  ('D-11-11','CHONG YONG ZHEN','Iron Work',800.00,800.00,false,'SO2601/192','JL','IW (C4)'),
  ('D-12-32','MOHD FAIZUL IZWAN BIN MOHD ZULKIPLI','Iron Work',2900.00,1650.00,false,'SO2601/197','OPL','IW'),
  ('E-11-07','RINDAH A/P TEAVAN','Iron Work',4200.00,3100.00,false,'SO2601/200','OPL','IW (C6)'),
  ('C-03A-08','ROHANA BINTI MAKIN','Iron Work',4200.00,200.00,false,'SO2601/279','LSL','IW'),
  ('D-01-22','NUREEN AFIQAH BINTI ARIF RUZIMAN','Iron Work',1900.00,200.00,false,'SO2601/287','CYM','IW'),
  ('D-12-10','TEE LIAN MENG','Iron Work',800.00,400.00,false,'SO2603/076','GES','IW (C5)'),
  ('E-12-07','KOH CHUN HOO','Iron Work',3300.00,1650.00,false,'SO2604/012','CYM','IW (C6)'),
  ('C-05-12','LIM SIOW MAY','Iron Work',3300.00,2100.00,false,'SO2604/022','BCY','IW (C7)'),
  ('A-06-16','CHI LEE FOON','Iron Work',1600.00,800.00,false,'SO2604/047','BCY','IW (C7)'),
  ('E-10-07','KOO ZI QIAN','Iron Work',1500.00,750.00,false,'SO2604/059','JL','IW (C7)'),
  ('C-15-11','LIM KIM TECK','Iron Work',2610.00,1305.00,false,'SO2605/031','WCSH','IW (C7)'),
  ('B-02-03A','NUR ALIZA AZLIN','Iron Work',3830.00,1915.00,false,'SO2605/039','CYM','IW (C7)'),
  ('E-11-01','WONDER HOUSE PROPERTY CONSULTANCY SDN BHD','Iron Work',960.00,480.00,false,'SO2605/052','JL','IW (C7)'),
  ('C-03-05','MUHAMMAD KHAIRY BIN ROSLI','Iron Work',3470.00,1935.00,false,'SO2601/135','OPL','IW (C3/2)'),
  ('B-10-09','KHEW CHUEN SHENG','Iron Work',1500.00,750.00,false,'SO2601/121','BCY','IW (C3/2)'),
  ('D-06-21','PANG CHEE MING','Iron Work',1100.00,550.00,false,'SO2604/073','CYM','IW (C7)'),
  ('A-05-03','MOH PEI YIN LIM VIM SEN','Iron Work',2400.00,1400.00,false,'SO2601/025','BCY','IW (C3/2)'),
  ('D-09-15','WAN NUR ATIQAH BINTI WAN KAMARRIZAM','Iron Work',300.00,150.00,false,'SO2604/100','JL','IW'),
  ('D-06-27','SURYA BINTI SELAMAT','Iron Work',1600.00,1250.00,false,'SO2604/008','BCY','IW (C7)'),
  ('B-11-07','LOO CHIAN','Iron Work',1834.00,200.00,false,'SO2605/025','LUCAS','IW (C7)'),
  ('E-07-03A','ROZAIMI BIN SHAFIEE','Iron Work',4610.00,1300.00,false,'SO2601/199','GES','IW (C7)'),
  ('A-10-27','ZETTY','Iron Work',3480.00,1740.00,false,'SO2606/015','BCY','IW(C7)'),
  ('D-11-21','CHAN KIM CHENG','Iron Work',850.00,425.00,false,'SO2606/016','CYM','IW (C7)'),
  ('B-11-10','LAI FOOK YONG','Iron Work',2610.00,1305.00,false,'SO2606/046','JL','IW'),
  ('D-09-36','NUURULAZWA BINTI HASAN','Iron Work',3480.00,2500.00,false,'SO2606/045','JL','IW / IG'),
  ('C-13A-03','SALEHUDIN BIN MOHAMAD','Iron Work',1980.00,990.00,false,'SO2606/050','KKC','IW'),
  ('D-07-03','CARMEN SEE HUI QIAO','Iron Work',2580.00,1290.00,false,'SO2606/088','GES','IW'),
  ('A-08-35','GOH HWEI WEN','Iron Work',1180.00,590.00,false,'','JL','IW'),
  ('A-06-05','NG KIM CHAI','Painting',1499.00,200.00,false,'SO2601/030','WCSH','PT'),
  ('A-07-31','ZURINAH BINTI MAT CHALIT','Painting',1949.00,200.00,false,'SO2601/042','LSL','PT'),
  ('A-07-33','IWAN HASLEY BIN HASHIM','Painting',2448.00,200.00,false,'SO2601/043','BCY','PT'),
  ('A-11-13','TITUS LIM XIU ERN','Painting',1499.00,200.00,false,'SO2601/072','WCSH','PT'),
  ('B-05-09','MUHIZAH BINTI RAHIM','Painting',3298.00,200.00,false,'SO2601/108','BCY','PT'),
  ('B-13A-09','VIVEKANANTHAN A/L SUBRAMANIAM','Painting',1999.00,200.00,false,'SO2601/130','WCSH','PT'),
  ('C-08-09','RENUGAH A/P VALAKANAN','Painting',1999.00,1199.50,false,'SO2601/147','JL','PT'),
  ('C-15-12','ERENE TAY AI KEE','Painting',2698.00,1549.00,false,'SO2601/158','WCSH','PT'),
  ('D-03-12','MUHAMMAD MUTHAWAKIL BIN HJ SHADIK MOHAMED','Painting',1499.00,200.00,false,'SO2601/169','WCSH','PT'),
  ('D-09-11','CHANTHIRAN A/L TANIMALEY','Painting',1499.00,950.00,false,'SO2601/184','WCSH','PT'),
  ('D-12-32','MOHD FAIZUL IZWAN BIN MOHD ZULKIPLI','Painting',1499.00,949.50,false,'SO2601/197','OPL','PT'),
  ('E-11-07','RINDAH A/P TEAVAN','Painting',1999.00,1199.50,false,'SO2601/200','OPL','PT'),
  ('D-02-23A','MOHD SHAHARIEZAL BIN ZAINUDIN','Painting',1499.00,200.00,false,'SO2601/289','BCY','PT'),
  ('D-12-30','ERENE TAY AI KEE','Painting',1998.00,1199.00,false,'SO2602/080','WCSH','PT'),
  ('A-06-16','CHI LEE FOON','Painting',1998.00,749.50,false,'SO2604/047','BCY','PT'),
  ('B-05-01','TOMMY TAN HONG LUN','Painting',1999.00,200.00,false,'SO2601/107','OPL','PT'),
  ('A-05-03','MOH PEI YIN LIM VIM SEN','Painting',1998.00,200.00,false,'SO2601/025','BCY','PT'),
  ('C-09-10','LEE CHONG CHEK','Painting',2698.00,1475.00,false,'SO2601/150','TSL','PT'),
  ('B-11-07','LOO CHIAN','Painting',2698.00,200.00,false,'SO2605/025','LUCAS','PT'),
  ('A-12-35','CHONG SIEW LEET','Painting',1499.00,749.50,false,'SO2603/036','KKC','PT'),
  ('D-07-09','NUUR ASHIQIN BINTI ROHAIDI','Aluminium Work',1625.00,812.50,true,'SO2601/179','BCY','AL'),
  ('D-10-15','YAP KOK KEONG','Aluminium Work',1400.00,700.00,true,'SO2603/064','LSL','AL'),
  ('D-08-13A','CHAN LEE WAH','Aluminium Work',1850.00,925.00,true,'SO2604/007','LSL','AL (C10)'),
  ('E-12-07','KOH CHUN HOO','Aluminium Work',1900.00,950.00,true,'SO2604/012','CYM','AL (C10)'),
  ('C-05-05','FATIMAH BINTI ABD MALIK','Aluminium Work',2080.00,1000.00,true,'SO2605/047','KKC','AL(C10)'),
  ('A-12-10','SHAHRIZAN BINTI MOHD SHARIF','Aluminium Work',1625.00,813.00,true,'SO2601/080','WCSH','AL (C9)'),
  ('B-11-07','LOO CHIAN','Aluminium Work',2080.00,200.00,false,'SO2605/025','LUCAS','AL'),
  ('C-13A-03','SALEHUDIN BIN MOHAMAD','Aluminium Work',2080.00,1040.00,true,'SO2606/050','KKC','AL'),
  ('D-01-23A','MUHAMMAD HARIF HASHAFIQ','Aluminium Work',2150.00,1075.00,false,'SO2606/079','BCY','AL'),
  ('D-01-21','NORELA','Aluminium Work',2150.00,1075.00,true,'SO2606/044','CYM','AL'),
  ('E-08-01','ALIYA','Aluminium Work',2080.00,1040.00,false,'','LSL','AL');

create temporary table _picmap (ref text primary key, pic text) on commit drop;
insert into _picmap (ref, pic) values
  ('WCSH','Winnie Chai'), ('LSL','Lian Sock Lee'), ('KKC','Kimchi'), ('OPL','Billy'), ('BCY','Sharon'), ('JL','Joey'), ('GES','Royce'), ('TSL','Sally'), ('LUCAS','Lucas'), ('CYM','Angel');

-- helper: normalised unit code
-- 1) create units that don't exist yet (match by normalised code)
with u as (select unit_code, max(customer) customer, sum(amount) total from _imp group by unit_code)
insert into public.jobs (customer_name, unit_code, project, order_total, stage, key_holder, updated_by)
select coalesce(nullif(trim(u.customer),''), u.unit_code), u.unit_code,
       'Ambience Pulau Gadong', 0, 'booked', 'Office', 'Import 01/07/26'
from u
where not exists (select 1 from public.jobs j
  where regexp_replace(lower(j.unit_code),'[^a-z0-9]','','g') = regexp_replace(lower(u.unit_code),'[^a-z0-9]','','g'));

-- 2) per-trade order amounts -> order_by_category (drop the stray 'Aluminium'), then order_total
with t as (select unit_code, trade, sum(amount) amt from _imp group by unit_code, trade),
     agg as (select unit_code, jsonb_object_agg(trade, amt) obc from t group by unit_code)
update public.jobs j
   set order_by_category = (coalesce(j.order_by_category,'{}'::jsonb) - 'Aluminium') || agg.obc
from agg
where regexp_replace(lower(j.unit_code),'[^a-z0-9]','','g') = regexp_replace(lower(agg.unit_code),'[^a-z0-9]','','g');

update public.jobs j
   set order_total = coalesce((select sum(v::numeric) from jsonb_each_text(j.order_by_category) e(k,v)),0)
where exists (select 1 from _imp i
  where regexp_replace(lower(j.unit_code),'[^a-z0-9]','','g') = regexp_replace(lower(i.unit_code),'[^a-z0-9]','','g'));

-- 3) assign PIC from the dominant Ref (only where blank)
with ranked as (
  select i.unit_code, p.pic,
         row_number() over (partition by i.unit_code order by count(*) desc, p.pic) rk
  from _imp i join _picmap p on p.ref = i.ref
  group by i.unit_code, p.pic)
update public.jobs j set pic = r.pic
from ranked r
where r.rk = 1 and coalesce(j.pic,'')=''
  and regexp_replace(lower(j.unit_code),'[^a-z0-9]','','g') = regexp_replace(lower(r.unit_code),'[^a-z0-9]','','g');

-- 4) one work card per (unit, trade); Completed if all that work is installed
with wc as (
  select unit_code, trade, bool_and(installed) all_installed,
         string_agg(distinct nullif(detail,''),', ') detail,
         string_agg(distinct nullif(so_no,''),', ') sos
  from _imp group by unit_code, trade),
  j as (select id, regexp_replace(lower(unit_code),'[^a-z0-9]','','g') nk from public.jobs)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, wc.trade, '',
       case when wc.all_installed then 'completed' else 'in_progress' end,
       'Imported: ' || coalesce(wc.detail,'') || coalesce(' ('||wc.sos||')',''), 'Import 01/07/26'
from wc join j on j.nk = regexp_replace(lower(wc.unit_code),'[^a-z0-9]','','g')
where not exists (select 1 from public.job_works w where w.job_id=j.id and w.category=wc.trade);

-- 5) per-trade deposit -> a Collection entry tagged to that trade
with d as (
  select unit_code, trade, sum(deposit) dep, string_agg(distinct nullif(so_no,''),', ') sos
  from _imp where deposit>0 group by unit_code, trade),
  j as (select id, regexp_replace(lower(unit_code),'[^a-z0-9]','','g') nk from public.jobs)
insert into public.claims (job_id, category, amount, work_category, note, collected_on)
select j.id, 'Booking Fee / Deposit', d.dep, d.trade,
       'Imported deposit '||d.trade||coalesce(' ('||d.sos||')',''), null
from d join j on j.nk = regexp_replace(lower(d.unit_code),'[^a-z0-9]','','g');

commit;
