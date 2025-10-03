-- Users table
create table if not exists users (
  id text primary key,
  email text not null,
  name text,
  avatar text
);

-- User data table
create table if not exists userdata (
  user_id text primary key references users(id) on delete cascade,
  data jsonb
);