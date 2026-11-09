-- ==========================================================================
-- Parche 3 (votación usuario): candidatas aproximadas RepDB para 24 sin exacta
-- Ejecutar en SQL Editor después del 01, 04 y 06
-- ==========================================================================
begin;
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/treadmill-running-main.webp' where id = 'ex-cf-14';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/sled-push-main.webp' where id = 'ex-cf-17';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/box-jump-start.webp' where id = 'ex-car-08';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/balance-dome-step-up-start.webp' where id = 'ex-car-10';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-lateral-walk-start.webp' where id = 'ex-car-11';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-lateral-walk-start.webp' where id = 'ex-car-12';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/barbell-box-squat-start.webp' where id = 'ex-car-13';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/heel-to-toe-walk-main.webp' where id = 'ex-car-15';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-lateral-walk-start.webp' where id = 'ex-car-17';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-lateral-walk-start.webp' where id = 'ex-car-19';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-shoulder-stretch-main.webp' where id = 'ex-mov-09';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/legs-up-the-wall-main.webp' where id = 'ex-mov-11';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/cable-external-rotation-start.webp' where id = 'ex-mov-19';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/banded-shoulder-stretch-main.webp' where id = 'ex-cor-10';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/ball-leg-curl-start.webp' where id = 'ex-cor-16';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/barbell-lunge-start.webp' where id = 'ex-agi-04';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/stair-climber-main.webp' where id = 'ex-agi-13';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/deep-squat-hold-main.webp' where id = 'ex-agi-18';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/balance-dome-crunch-start.webp' where id = 'ex-agi-19';
select count(*) as con_imagen from public.exercise_library where image_url <> '';
commit;
