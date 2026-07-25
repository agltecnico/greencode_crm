-- One-time data migration: existing planner targets were stored as sowing
-- weekdays. Preserve their schedules while reinterpreting the selected weekday
-- as the desired harvest weekday.
update public.harvest_targets as ht
set "targetDayOfWeek" = mod(
  (
    ht."targetDayOfWeek"::numeric
    + case
        when coalesce(ct."soakingHours"::numeric, 0) > 0
          then greatest(1, ceil(ct."soakingHours"::numeric / 24))
        else 0
      end
    + coalesce(ct."germinationDays"::numeric, 0)
    + coalesce(ct."darknessDays"::numeric, 0)
    + coalesce(ct."lightDays"::numeric, 0)
  )::integer,
  7
)
from public.crop_types as ct
where ct.id = ht."productId";
