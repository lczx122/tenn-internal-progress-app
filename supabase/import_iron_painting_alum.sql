-- ============================================================================
--  Import: Iron / Painting / Aluminium balance work (as of 31/05/26)
-- ----------------------------------------------------------------------------
--  Source: BALANCE IRON, PAINTING, ALUM WORK 31 MAY 26.xls (3 sheets).
--  Creates/extends Units (project 'Ambience Pulau Gadong'), adds a work card per
--  app category (Iron + Aluminium -> Aluminium, Painting -> Painting; Completed
--  where installed, else In Progress), backfills order totals, assigns each
--  unit's PIC from the Ref initials, and logs each unit's deposit under
--  Collection. Matches existing units by unit code -> SAFE TO RE-RUN.
--
--  Ref -> PIC: WCSH=Winnie, LSL=Ah Lee, KKC=Kimchi, OPL=Billy, BCY=Sharon,
--  JL=Joey, GES=Royce, TSL=Sally, LUCAS=Lucas. CYM left unassigned.
--
--  Run ONCE in Supabase -> SQL Editor.
-- ============================================================================
begin;

create temporary table _imp (
  unit_code text, customer text, work_cat text,
  amount numeric, deposit numeric, installed boolean,
  so_no text, ref text, detail text
) on commit drop;

insert into _imp (unit_code, customer, work_cat, amount, deposit, installed, so_no, ref, detail) values
  ('A-03A-10','FATHUL FAQIHIN BIN AZMAN','Aluminium',800,600,false,'SO2601/022','CYM','IW (C6)'),
  ('A-06-05','NG KIM CHAI','Aluminium',2900,200,false,'SO2601/030','WCSH','IW'),
  ('A-06-36','LEE YUN KIAN','Aluminium',800,200,false,'SO2601/038','CYM','IW'),
  ('A-07-31','ZURINAH BINTI MAT CHALIT','Aluminium',2100,200,false,'SO2601/042','LSL','IW'),
  ('A-08-31','LIM YEE LIANG','Aluminium',1900,1150,false,'SO2601/048','WCSH','IW (C4)'),
  ('A-10-10','TING HUEY YIN','Aluminium',800,600,true,'SO2601/057','CYM','IW (C6)'),
  ('A-11-03','PANG MEI YENG','Aluminium',1600,200,false,'SO2601/071','GES','IW'),
  ('A-11-32','ABDUL MUNZIL BIN MOHD YUSOF','Aluminium',300,200,true,'SO2601/074','KKC','IW (C6)'),
  ('B-01-02','NUR ADILAH BINTI MOHAMMAD AZHAR','Aluminium',3300,1850,false,'SO2601/099','JL','IW (C6)'),
  ('B-07-03A','GAN YONG YANG','Aluminium',1500,950,true,'SO2601/114','BCY','IW (C6)'),
  ('B-08-05','LIM SHENGHUAH','Aluminium',2560,200,false,'SO2601/117','WCSH','IW'),
  ('B-12-06','HAMBALI BIN MAHADI','Aluminium',3150,1775,true,'SO2601/125','OPL','IW (C6)'),
  ('B-13-03','ONG KAI BOON','Aluminium',2400,1400,true,'SO2601/128','KKC','IW (C4)'),
  ('B-13A-09','VIVEKANANTHAN A/L SUBRAMANIAM','Aluminium',4200,2300,false,'SO2601/130','WCSH','IW (C6)'),
  ('A-07-07','NG YONG CHUAN','Aluminium',800,800,false,'SO2601/134','JL','IW (C5)*'),
  ('C-07-03A','KUMARESAN A/L SIVALINGAM','Aluminium',4200,2300,false,'SO2601/142','WCSH','IW (C7)'),
  ('C-07-06','SHARVIN A/L N.VIVEKANANDAN','Aluminium',4200,200,false,'SO2601/143','WCSH','IW'),
  ('C-07-07','PUVENDRA A/L AHCHUTAN','Aluminium',900,650,false,'SO2601/144','LSL','IW (C7)'),
  ('C-07-11','AGNES SEOW CHEN CHI','Aluminium',1500,1000,false,'SO2601/145','TSL','IW (C5)'),
  ('C-08-09','RENUGAH A/P VALAKANAN','Aluminium',5570,2985,true,'SO2601/147','JL','IW (C6)'),
  ('C-08-10','KOH HOW LUEN','Aluminium',2400,1400,false,'SO2601/148','OPL','IW (C6)'),
  ('C-09-09','TAN KEH LEE','Aluminium',4200,2300,true,'SO2601/149','WCSH','IW (C5)'),
  ('C-12-09','MUHAMMAD NAZIRULAKHMAL BIN ROSE MAN','Aluminium',3310,200,false,'SO2601/153','KKC','IW'),
  ('C-13-06','TANG ENG CHEN','Aluminium',1500,950,true,'SO2601/155','CYM','IW (C6)'),
  ('C-13A-06','MOHD SABRI BIN SHAHIDAN','Aluminium',3150,1775,true,'SO2601/156','LSL','IW (C6)'),
  ('D-03-12','MUHAMMAD MUTHAWAKIL BIN HJ SHADIK MOHAMED','Aluminium',2900,200,false,'SO2601/169','WCSH','IW'),
  ('D-06-08','AHMAD TAUFIK BIN ABD GHAPAR','Aluminium',2900,200,false,'SO2601/173','WCSH','IW'),
  ('D-06-15','MARIATI BINTI CHE OMAR','Aluminium',2900,200,false,'SO2601/174','WCSH','IW'),
  ('D-06-30','ARYANTI BINTI RUSNI','Aluminium',3300,1850,true,'SO2601/176','KKC','IW (C6) / IG'),
  ('D-06-38','AINUDIN BIN AFANDI','Aluminium',2900,200,false,'SO2601/178','KKC','IW'),
  ('D-07-09','NUUR ASHIQIN BINTI ROHAIDI','Aluminium',1750,1075,false,'SO2601/179','BCY','IW / IG (C7)'),
  ('D-07-13','ROSLIMI BIN ABD GHANI','Aluminium',3540,3540,true,'SO2601/180','LSL','IW (C6)*'),
  ('D-09-11','CHANTHIRAN A/L TANIMALEY','Aluminium',2900,1650,false,'SO2601/184','WCSH','IW'),
  ('D-10-27','SITI AZURA BINTI MOHD HASRIN','Aluminium',1100,1100,true,'SO2601/188','JL','IW (C6)*'),
  ('D-10-36','KELLY NATASYA','Aluminium',800,400,false,'SO2601/190','KKC','IW'),
  ('D-10-37','MUHAMMAD HANIFF BIN ABDUL AZIZ','Aluminium',800,600,true,'SO2601/191','OPL','IW (C6)'),
  ('D-11-11','CHONG YONG ZHEN','Aluminium',800,800,false,'SO2601/192','JL','IW (C4)'),
  ('D-12-11','SALWA BINTI MAHMOOD','Aluminium',800,600,true,'SO2601/195','BCY','IW (C6)'),
  ('D-12-23A','NORAIDAH BINTI MOHAMAD','Aluminium',2900,1650,true,'SO2601/196','JL','IW (C6)'),
  ('D-12-32','MOHD FAIZUL IZWAN BIN MOHD ZULKIPLI','Aluminium',2900,1650,false,'SO2601/197','OPL','IW'),
  ('E-11-07','RINDAH A/P TEAVAN','Aluminium',4200,3100,false,'SO2601/200','OPL','IW (C6)'),
  ('C-03A-08','ROHANA BINTI MAKIN','Aluminium',4200,200,false,'SO2601/279','LSL','IW'),
  ('D-01-22','NUREEN AFIQAH BINTI ARIF RUZIMAN','Aluminium',1900,200,false,'SO2601/287','CYM','IW'),
  ('A-05-36','KAMSIAH BINTI MANSOOR','Aluminium',2350,1375,true,'SO2602/023','KKC','IW (C4)'),
  ('D-12-10','TEE LIAN MENG','Aluminium',800,400,false,'SO2603/076','GES','IW (C5)'),
  ('A-07-11','KANG TIAN LEONG','Aluminium',1550,1550,true,'SO2603/085','CYM','IW (C6)* / IG (C4)-CP'),
  ('D-G-28','SOO SHI CHING','Aluminium',3950,3950,true,'SO2603/111','LSL','IW (C6)*'),
  ('A-12-08','LIM KIAT SING','Aluminium',1600,1600,true,'SO2603/113','KKC','IW (C6)*'),
  ('D-08-13A','CHAN LEE WAH','Aluminium',2850,1425,true,'SO2604/007','LSL','IW (C6)'),
  ('E-12-07','KOH CHUN HOO','Aluminium',3300,1650,false,'SO2604/012','CYM','IW (C6)'),
  ('C-05-12','LIM SIOW MAY','Aluminium',3300,2100,false,'SO2604/022','BCY','IW (C7)'),
  ('D-10-38','THAVAMANI A/P R.SEMPOSOTHY','Aluminium',800,400,true,'SO2604/024','BCY','IW (C6)'),
  ('D-09-16','TAN XIN YEE','Aluminium',800,400,true,'SO2604/027','CYM','IW (C6)'),
  ('D-10-09','ZENO STUDIO','Aluminium',800,400,true,'SO2604/043','JL','IW (C6)'),
  ('A-06-16','CHI LEE FOON','Aluminium',1600,800,false,'SO2604/047','BCY','IW (C7)'),
  ('E-10-07','KOO ZI QIAN','Aluminium',1500,750,false,'SO2604/059','JL','IW (C7)'),
  ('D-03A-36','MICKY ANAK DENGGAT','Aluminium',800,400,true,'SO2604/060','BCY','IW (C6)'),
  ('C-15-11','LIM KIM TECK','Aluminium',2610,1305,false,'SO2605/031','WCSH','IW (C7)'),
  ('B-02-03A','NUR ALIZA AZLIN','Aluminium',3830,1915,false,'SO2605/039','CYM','IW (C7)'),
  ('E-11-01','WONDER HOUSE PROPERTY CONSULTANCY SDN BHD','Aluminium',960,480,false,'SO2605/052','JL','IW (C7)'),
  ('C-03-05','MUHAMMAD KHAIRY BIN ROSLI','Aluminium',3470,1935,false,'SO2601/135','OPL','IW (C3/2)'),
  ('B-10-09','KHEW CHUEN SHENG','Aluminium',1500,750,false,'SO2601/121','BCY','IW (C3/2)'),
  ('D-06-21','PANG CHEE MING','Aluminium',1100,550,false,'SO2604/073','CYM','IW (C7)'),
  ('A-05-03','MOH PEI YIN','Aluminium',2400,1400,false,'SO2601/025','BCY','IW (C3/2)'),
  ('D-09-15','WAN NUR ATIQAH BINTI WAN KAMARRIZAM','Aluminium',300,150,false,'SO2604/100','JL','IW'),
  ('A-08-15','HAIRUL NIZAM BIN MAHAT','Aluminium',2850,1625,true,'SO2601/047','BCY','IW (C6)'),
  ('D-06-27','SURYA BINTI SELAMAT','Aluminium',1600,1250,false,'SO2604/008','BCY','IW (C7)'),
  ('D-09-23','THAVAMALAR A/P MAGALINGAM','Aluminium',3180,1600,true,'SO2601/186','BCY','IW (C5) / IG'),
  ('C-09-10','LEE CHONG CHEK','Aluminium',3450,1925,true,'SO2601/150','TSL','IW (C6)'),
  ('D-07-23A','NURUL FADEHA BINTI ISMAIL','Aluminium',2500,1450,true,'SO2601/182','OPL','IW (C6) / IG'),
  ('E-02-05','KUAN CHIN THANG','Aluminium',6430,3215,true,'SO2603/100','GES','IW (C6) / IG (C5)'),
  ('B-11-07','LOO CHIAN','Aluminium',1834,200,false,'SO2605/025','LUCAS','IW (C7)'),
  ('E-07-03A','ROZAIMI BIN SHAFIEE','Aluminium',4610,1300,false,'SO2601/199','GES','IW (C7)'),
  ('A-10-27','ZETTY','Aluminium',3480,1740,false,'SO2606/015','BCY','IW(C7)'),
  ('D-11-21','CHAN KIM CHENG','Aluminium',850,425,false,'SO2606/016','CYM','IW (C7)'),
  ('A-06-05','NG KIM CHAI','Painting',1499,200,false,'SO2601/030','WCSH','PT'),
  ('A-07-31','ZURINAH BINTI MAT CHALIT','Painting',1949,200,false,'SO2601/042','LSL','PT'),
  ('A-07-33','IWAN HASLEY BIN HASHIM','Painting',2448,200,false,'SO2601/043','BCY','PT'),
  ('A-11-13','TITUS LIM XIU ERN','Painting',1499,200,false,'SO2601/072','WCSH','PT'),
  ('B-03A-06','NOOR AZHAR TAHIR','Painting',1999,200,false,'SO2601/106','GES','PT'),
  ('B-05-09','MUHIZAH BINTI RAHIM','Painting',3298,200,false,'SO2601/108','BCY','PT'),
  ('B-08-05','LIM SHENGHUAH','Painting',1999,200,false,'SO2601/117','WCSH','PT'),
  ('B-13A-09','VIVEKANANTHAN A/L SUBRAMANIAM','Painting',1999,200,false,'SO2601/130','WCSH','PT'),
  ('C-08-09','RENUGAH A/P VALAKANAN','Painting',1999,1199.5,true,'SO2601/147','JL','PT'),
  ('C-15-12','ERENE TAY AI KEE','Painting',2698,1549,true,'SO2601/158','WCSH','PT'),
  ('D-03-12','MUHAMMAD MUTHAWAKIL BIN HJ SHADIK MOHAMED','Painting',1499,200,false,'SO2601/169','WCSH','PT'),
  ('D-09-11','CHANTHIRAN A/L TANIMALEY','Painting',1499,950,false,'SO2601/184','WCSH','PT'),
  ('D-12-32','MOHD FAIZUL IZWAN BIN MOHD ZULKIPLI','Painting',1499,949.5,false,'SO2601/197','OPL','PT'),
  ('E-11-07','RINDAH A/P TEAVAN','Painting',1999,1199.5,false,'SO2601/200','OPL','PT'),
  ('D-02-23A','MOHD SHAHARIEZAL BIN ZAINUDIN','Painting',1499,200,false,'SO2601/289','BCY','PT'),
  ('D-12-30','ERENE TAY AI KEE','Painting',1998,1199,true,'SO2602/080','WCSH','PT'),
  ('A-06-16','CHI LEE FOON','Painting',1499,749.5,false,'SO2604/047','BCY','PT'),
  ('B-05-01','TOMMY TAN HONG LUN','Painting',1999,200,true,'SO2601/107','OPL','PT'),
  ('A-05-03','MOH PEI YIN','Painting',1499,200,false,'SO2601/025','BCY','PT'),
  ('C-09-10','LEE CHONG CHEK','Painting',2698,1475,true,'SO2601/150','TSL','PT'),
  ('B-11-07','LOO CHIAN','Painting',2698,200,false,'SO2605/025','LUCAS','PT'),
  ('D-07-09','NUUR ASHIQIN BINTI ROHAIDI','Aluminium',1625,812.5,false,'SO2601/179','BCY','AL'),
  ('D-10-15','YAP KOK KEONG','Aluminium',1400,700,false,'SO2603/064','LSL','AL'),
  ('D-08-13A','CHAN LEE WAH','Aluminium',1850,925,true,'SO2604/007','LSL','AL (C10)'),
  ('E-12-07','KOH CHUN HOO','Aluminium',1900,950,true,'SO2604/012','CYM','AL (C10)'),
  ('C-05-05','FATIMAH BINTI ABD MALIK','Aluminium',2080,1000,true,'SO2605/047','KKC','AL(C10)'),
  ('A-12-10','SHAHRIZAN BINTI MOHD SHARIF','Aluminium',1625,813,true,'SO2601/080','WCSH','AL (C9)'),
  ('B-11-07','LOO CHIAN','Aluminium',2080,200,false,'SO2605/025','LUCAS','AL');

create temporary table _picmap (ref text primary key, pic text) on commit drop;
insert into _picmap (ref, pic) values
  ('WCSH','Winnie'), ('LSL','Ah Lee'), ('KKC','Kimchi'), ('OPL','Billy'),
  ('BCY','Sharon'), ('JL','Joey'), ('GES','Royce'), ('TSL','Sally'), ('LUCAS','Lucas');

-- 1) create units that don't already exist (match by normalised unit code)
with u as (select unit_code, max(customer) as customer, sum(amount) as total from _imp group by unit_code)
insert into public.jobs (customer_name, unit_code, project, order_total, stage, key_holder, updated_by)
select coalesce(nullif(trim(u.customer),''), u.unit_code), u.unit_code,
       'Ambience Pulau Gadong', u.total, 'booked', 'Office', 'Import 31/05/26'
from u
where not exists (
  select 1 from public.jobs j
  where lower(regexp_replace(j.unit_code,'[^a-z0-9]','','g')) = lower(regexp_replace(u.unit_code,'[^a-z0-9]','','g')));

-- 2) backfill order_total on matched units that had none
with u as (select unit_code, sum(amount) as total from _imp group by unit_code)
update public.jobs j set order_total = u.total
from u
where lower(regexp_replace(j.unit_code,'[^a-z0-9]','','g')) = lower(regexp_replace(u.unit_code,'[^a-z0-9]','','g'))
  and coalesce(j.order_total,0) = 0;

-- 3) assign PIC from the dominant mapped Ref (only where currently blank)
with ranked as (
  select i.unit_code, p.pic,
         row_number() over (partition by i.unit_code order by count(*) desc, p.pic) as rk
  from _imp i join _picmap p on p.ref = i.ref
  group by i.unit_code, p.pic)
update public.jobs j set pic = r.pic
from ranked r
where r.rk = 1
  and lower(regexp_replace(j.unit_code,'[^a-z0-9]','','g')) = lower(regexp_replace(r.unit_code,'[^a-z0-9]','','g'))
  and coalesce(j.pic,'') = '';

-- 4) one work card per (unit, category); Completed if all that work is installed
with wc as (
  select unit_code, work_cat, bool_and(installed) as all_installed,
         string_agg(distinct nullif(detail,''), ', ') as detail,
         string_agg(distinct so_no, ', ') as sos
  from _imp group by unit_code, work_cat),
j as (select id, lower(regexp_replace(unit_code,'[^a-z0-9]','','g')) as nk from public.jobs)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, wc.work_cat, '',
       case when wc.all_installed then 'completed' else 'in_progress' end,
       'Imported: ' || coalesce(wc.detail,'') || ' (' || wc.sos || ')', 'Import 31/05/26'
from wc join j on j.nk = lower(regexp_replace(wc.unit_code,'[^a-z0-9]','','g'))
where not exists (select 1 from public.job_works w where w.job_id = j.id and w.category = wc.work_cat);

-- 5) deposit per unit -> one Collection entry (idempotent by note prefix)
with d as (
  select unit_code, sum(deposit) as dep, string_agg(distinct so_no, ', ') as sos
  from _imp where deposit > 0 group by unit_code),
j as (select id, lower(regexp_replace(unit_code,'[^a-z0-9]','','g')) as nk from public.jobs)
insert into public.claims (job_id, category, amount, note, collected_on)
select j.id, 'Booking Fee / Deposit', d.dep, 'Imported deposit (' || d.sos || ')', null
from d join j on j.nk = lower(regexp_replace(d.unit_code,'[^a-z0-9]','','g'))
where not exists (select 1 from public.claims c where c.job_id = j.id and c.note like 'Imported deposit%');

commit;
