-- KST 자정 = UTC 15:00 (전날)
select cron.schedule(
  'expire-old-vouchers-daily',
  '0 15 * * *',
  $$ select expire_old_vouchers(); $$
);
