-- Garden App schema — paste this whole file into the Supabase SQL editor and run it once.

create table if not exists settings (
  id          int primary key default 1 check (id = 1),  -- singleton row
  zip         text,
  zone        text,                                      -- e.g. '8b'
  last_frost  date,                                      -- avg last spring frost
  first_frost date,                                      -- avg first fall frost
  updated_at  timestamptz default now()
);

create table if not exists beds (
  id       serial primary key,
  name     text not null,
  position int not null,
  notes    text
);

create table if not exists plantings (
  id           serial primary key,
  bed_id       int not null references beds(id),
  crop         text not null,
  variety      text,
  family       text,                                     -- plant family, drives rotation
  planted_date date not null,
  removed_date date,                                     -- null = currently in the bed
  source       text not null default 'manual' check (source in ('manual','chat','plan')),
  notes        text
);
create index if not exists idx_plantings_bed on plantings(bed_id, planted_date desc);

create table if not exists seasons (
  id         serial primary key,
  year       int not null,
  label      text not null,
  status     text not null default 'planning' check (status in ('planning','active','done')),
  plan_json  jsonb,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id          serial primary key,
  season_id   int references seasons(id),
  bed_id      int references beds(id),
  planting_id int references plantings(id),
  type        text not null check (type in ('plant','fertilize','harvest','remove','water','other')),
  title       text not null,
  details     text,
  crop        text,
  due_start   date not null,
  due_end     date not null,
  done_at     timestamptz
);
create index if not exists idx_tasks_open on tasks(due_start) where done_at is null;

create table if not exists chat_log (
  id         serial primary key,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  tool_calls jsonb,
  created_at timestamptz default now()
);

-- Seed the 16 beds if the table is empty
insert into beds (name, position)
select 'Bed ' || n, n from generate_series(1, 16) n
where not exists (select 1 from beds);
