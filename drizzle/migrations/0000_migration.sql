create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','hod','teacher');

create table public.departments(id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, created_at timestamptz default now());
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', email text, phone text, department_id uuid references public.departments(id) on delete set null, designation text, qualification text, experience_years int default 0, created_at timestamptz default now());
create table public.user_roles(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
create table public.subjects(id uuid primary key default gen_random_uuid(), department_id uuid not null references public.departments(id) on delete cascade, code text not null, name text not null, semester int not null default 1, credits int not null default 3);
create table public.allocations(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade, subject_id uuid not null references public.subjects(id) on delete cascade, section text not null default 'A', hours_per_week int not null default 4);
create table public.schedules(id uuid primary key default gen_random_uuid(), allocation_id uuid not null references public.allocations(id) on delete cascade, day_of_week int not null, start_time time not null, end_time time not null, room text);
create table public.attendance_records(id uuid primary key default gen_random_uuid(), allocation_id uuid not null references public.allocations(id) on delete cascade, class_date date not null default current_date, total_students int not null, present_count int not null, created_at timestamptz default now());
create table public.marks(id uuid primary key default gen_random_uuid(), allocation_id uuid not null references public.allocations(id) on delete cascade, exam_name text not null, student_roll text not null, marks_obtained numeric not null, max_marks numeric not null default 50, created_at timestamptz default now());
create table public.faculty_attendance(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade, work_date date not null default current_date, status text not null default 'present', unique(teacher_id, work_date));
create table public.announcements(id uuid primary key default gen_random_uuid(), author_id uuid references public.profiles(id) on delete set null, department_id uuid references public.departments(id) on delete cascade, title text not null, body text not null, created_at timestamptz default now());
create table public.dept_requests(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade, department_id uuid references public.departments(id) on delete cascade, title text not null, body text not null, status text not null default 'pending', review_note text, reviewed_by uuid references public.profiles(id) on delete set null, created_at timestamptz default now());

grant select, insert, update, delete on public.departments, public.profiles, public.subjects, public.allocations, public.schedules, public.attendance_records, public.marks, public.faculty_attendance, public.announcements, public.dept_requests to authenticated;
grant select on public.user_roles to authenticated;
grant all on public.departments, public.profiles, public.user_roles, public.subjects, public.allocations, public.schedules, public.attendance_records, public.marks, public.faculty_attendance, public.announcements, public.dept_requests to service_role;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.my_dept() returns uuid language sql stable security definer set search_path=public as $$ select department_id from public.profiles where id=auth.uid() $$;
create or replace function public.dept_of(_uid uuid) returns uuid language sql stable security definer set search_path=public as $$ select department_id from public.profiles where id=_uid $$;
create or replace function public.alloc_teacher(_a uuid) returns uuid language sql stable security definer set search_path=public as $$ select teacher_id from public.allocations where id=_a $$;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.subjects enable row level security;
alter table public.allocations enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance_records enable row level security;
alter table public.marks enable row level security;
alter table public.faculty_attendance enable row level security;
alter table public.announcements enable row level security;
alter table public.dept_requests enable row level security;

-- departments/subjects: everyone signed in reads, admin writes
create policy "read depts" on public.departments for select to authenticated using (true);
create policy "admin depts" on public.departments for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "read subjects" on public.subjects for select to authenticated using (true);
create policy "admin subjects" on public.subjects for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

-- roles
create policy "own roles" on public.user_roles for select to authenticated using (user_id=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(user_id)=my_dept()));

-- profiles
create policy "own profile" on public.profiles for select to authenticated using (id=auth.uid());
create policy "admin profiles" on public.profiles for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "hod sees dept teachers" on public.profiles for select to authenticated using (has_role(auth.uid(),'hod') and department_id=my_dept() and has_role(id,'teacher') and not has_role(id,'hod'));
create policy "update own profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and department_id is not distinct from my_dept());

-- allocations
create policy "alloc read" on public.allocations for select to authenticated using (teacher_id=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept()));
create policy "alloc admin" on public.allocations for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "alloc hod" on public.allocations for all to authenticated using (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept()) with check (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept());

-- schedules, attendance, marks share allocation scope
create policy "sched read" on public.schedules for select to authenticated using (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(alloc_teacher(allocation_id))=my_dept()));
create policy "sched write" on public.schedules for all to authenticated using (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(alloc_teacher(allocation_id))=my_dept())) with check (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(alloc_teacher(allocation_id))=my_dept()));
create policy "att read" on public.attendance_records for select to authenticated using (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(alloc_teacher(allocation_id))=my_dept()));
create policy "att write" on public.attendance_records for all to authenticated using (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin')) with check (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin'));
create policy "marks read" on public.marks for select to authenticated using (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(alloc_teacher(allocation_id))=my_dept()));
create policy "marks write" on public.marks for all to authenticated using (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin')) with check (alloc_teacher(allocation_id)=auth.uid() or has_role(auth.uid(),'admin'));

-- faculty attendance
create policy "fa read" on public.faculty_attendance for select to authenticated using (teacher_id=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept()));
create policy "fa write" on public.faculty_attendance for all to authenticated using (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept())) with check (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and dept_of(teacher_id)=my_dept()));

-- announcements
create policy "ann read" on public.announcements for select to authenticated using (department_id is null or department_id=my_dept() or has_role(auth.uid(),'admin'));
create policy "ann admin" on public.announcements for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create policy "ann hod insert" on public.announcements for insert to authenticated with check (has_role(auth.uid(),'hod') and department_id=my_dept() and author_id=auth.uid());
create policy "ann hod delete" on public.announcements for delete to authenticated using (has_role(auth.uid(),'hod') and author_id=auth.uid());

-- requests
create policy "req read" on public.dept_requests for select to authenticated using (teacher_id=auth.uid() or has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and department_id=my_dept()));
create policy "req insert" on public.dept_requests for insert to authenticated with check (teacher_id=auth.uid() and department_id=my_dept() and status='pending');
create policy "req review" on public.dept_requests for update to authenticated using (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and department_id=my_dept())) with check (has_role(auth.uid(),'admin') or (has_role(auth.uid(),'hod') and department_id=my_dept()));

-- ===== SAMPLE DATA =====
do $$
declare
  cse uuid := gen_random_uuid(); ece uuid := gen_random_uuid(); mech uuid := gen_random_uuid();
  u record; a uuid; s uuid; i int; d int;
begin
  insert into public.departments(id,name,code) values (cse,'Computer Science & Engineering','CSE'),(ece,'Electronics & Communication','ECE'),(mech,'Mechanical Engineering','MECH');
  insert into public.subjects(department_id,code,name,semester,credits) values
   (cse,'CS301','Data Structures',3,4),(cse,'CS302','Database Systems',3,4),(cse,'CS501','Machine Learning',5,3),(cse,'CS502','Operating Systems',5,4),
   (ece,'EC301','Signals & Systems',3,4),(ece,'EC302','Digital Electronics',3,3),(ece,'EC501','VLSI Design',5,3),
   (mech,'ME301','Thermodynamics',3,4),(mech,'ME302','Fluid Mechanics',3,4),(mech,'ME501','Machine Design',5,3);

  for u in select * from (values
    ('admin@campus.edu','Dr. Rajesh Kumar','admin',null::uuid,'Principal','PhD Physics',25),
    ('hod.cse@campus.edu','Dr. Anita Sharma','hod',cse,'Professor & HOD','PhD Computer Science',18),
    ('hod.ece@campus.edu','Dr. Vikram Rao','hod',ece,'Professor & HOD','PhD Electronics',16),
    ('hod.mech@campus.edu','Dr. Suresh Patel','hod',mech,'Professor & HOD','PhD Mechanical',20),
    ('priya@campus.edu','Priya Nair','teacher',cse,'Assistant Professor','M.Tech CSE',6),
    ('arjun@campus.edu','Arjun Mehta','teacher',cse,'Associate Professor','PhD AI',11),
    ('kavya@campus.edu','Kavya Reddy','teacher',cse,'Assistant Professor','M.Tech IT',3),
    ('rohan@campus.edu','Rohan Das','teacher',ece,'Assistant Professor','M.Tech VLSI',5),
    ('sneha@campus.edu','Sneha Iyer','teacher',ece,'Associate Professor','PhD Signal Processing',9),
    ('amit@campus.edu','Amit Singh','teacher',mech,'Assistant Professor','M.Tech Thermal',4),
    ('meera@campus.edu','Meera Joshi','teacher',mech,'Associate Professor','PhD Design',12)
  ) as t(email,name,role,dept,des,qual,exp) loop
    s := gen_random_uuid();
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
    values('00000000-0000-0000-0000-000000000000',s,'authenticated','authenticated',u.email,crypt('Campus@123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(gen_random_uuid(),s,s::text,jsonb_build_object('sub',s::text,'email',u.email,'email_verified',true),'email',now(),now(),now());
    insert into public.profiles(id,full_name,email,department_id,designation,qualification,experience_years,phone) values(s,u.name,u.email,u.dept,u.des,u.qual,u.exp,'+91 98'||lpad((floor(random()*100000000))::text,8,'0'));
    insert into public.user_roles(user_id,role) values(s,u.role::app_role);
    if u.role='hod' then insert into public.user_roles(user_id,role) values(s,'teacher'); end if;
  end loop;

  -- allocations: each teacher gets subjects of their dept
  insert into public.allocations(teacher_id,subject_id,section,hours_per_week)
  select p.id, sb.id, sec, (3+floor(random()*4))::int
  from public.profiles p join public.user_roles r on r.user_id=p.id and r.role='teacher'
  cross join lateral (select id from public.subjects where department_id=p.department_id order by random() limit (1+floor(random()*3))::int) sb
  cross join lateral (select (array['A','B'])[1+floor(random()*2)::int] sec) x
  where not exists(select 1 from public.user_roles h where h.user_id=p.id and h.role='hod');

  for a in select id from public.allocations loop
    insert into public.schedules(allocation_id,day_of_week,start_time,end_time,room)
    select a, dd, make_time(9+hh,0,0), make_time(10+hh,0,0), 'R-'||(100+floor(random()*50))::int
    from (select (1+floor(random()*5))::int dd, floor(random()*6)::int hh from generate_series(1,2)) z;
    for i in 0..19 loop
      insert into public.attendance_records(allocation_id,class_date,total_students,present_count)
      values(a, current_date - (i*3), 60, 38+floor(random()*22)::int);
    end loop;
    for i in 1..30 loop
      insert into public.marks(allocation_id,exam_name,student_roll,marks_obtained,max_marks)
      values(a,'Internal 1','R'||lpad(i::text,3,'0'),round((15+random()*35)::numeric,1),50),
            (a,'Internal 2','R'||lpad(i::text,3,'0'),round((15+random()*35)::numeric,1),50);
    end loop;
  end loop;

  insert into public.faculty_attendance(teacher_id,work_date,status)
  select p.id, current_date-d2, case when random()<0.9 then 'present' when random()<0.5 then 'leave' else 'absent' end
  from public.profiles p, generate_series(0,29) d2 where p.department_id is not null;

  insert into public.announcements(author_id,department_id,title,body)
  select id,null,'Mid-semester review','Submit internal marks for all sections before the 20th.' from public.profiles where email='admin@campus.edu';
  insert into public.announcements(author_id,department_id,title,body)
  select id,cse,'Department meeting','CSE faculty meeting on Friday 3 PM in the seminar hall.' from public.profiles where email='hod.cse@campus.edu';

  insert into public.dept_requests(teacher_id,department_id,title,body)
  select id,department_id,'Lab equipment request','Requesting 10 new systems for the ML lab.' from public.profiles where email='arjun@campus.edu';
  insert into public.dept_requests(teacher_id,department_id,title,body,status)
  select id,department_id,'Conference leave','Leave for 3 days to attend IEEE conference.','approved' from public.profiles where email='priya@campus.edu';
end $$;