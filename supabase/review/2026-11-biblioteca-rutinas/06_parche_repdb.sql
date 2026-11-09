-- ==========================================================================
-- Parche 2: RepDB (701, ES) para los 62 sin imagen de free-exercise-db
-- Ejecutar en SQL Editor después del 01 y del 04
-- Atribución requerida: Exercise data by RepDB (repdb.co)
-- ==========================================================================
begin;
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/wall-sit-main.webp' where id = 'ex-pes-08';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/hollow-body-hold-main.webp' where id = 'ex-pes-15';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/side-lunge-start.webp' where id = 'ex-pes-17';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/burpees-main.webp' where id = 'ex-cf-01';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/wall-ball-main.webp' where id = 'ex-cf-03';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/jump-rope-main.webp' where id = 'ex-cf-07';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/jump-rope-main.webp' where id = 'ex-cf-08';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/push-jerk-start.webp' where id = 'ex-cf-12';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/ski-erg-start.webp' where id = 'ex-cf-24';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/kettlebell-deadlift-start.webp' where id = 'ex-kb-10';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/kettlebell-halo-start.webp' where id = 'ex-kb-11';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/kettlebell-bottoms-up-hold-main.webp' where id = 'ex-kb-14';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/hang-snatch-start.webp' where id = 'ex-hal-04';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/push-jerk-start.webp' where id = 'ex-hal-12';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/split-jerk-start.webp' where id = 'ex-hal-15';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/jumping-jacks-start.webp' where id = 'ex-car-01';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/high-knees-main.webp' where id = 'ex-car-03';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/stationary-bike-main.webp' where id = 'ex-car-05';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/incline-treadmill-walk-main.webp' where id = 'ex-car-06';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/jump-rope-main.webp' where id = 'ex-car-14';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/knee-to-chest-stretch-main.webp' where id = 'ex-car-16';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/90-90-hold-main.webp' where id = 'ex-mov-01';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/worlds-greatest-stretch-start.webp' where id = 'ex-mov-02';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/cat-cow-main.webp' where id = 'ex-mov-03';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/thoracic-bridge-main.webp' where id = 'ex-mov-04';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/ball-pike-start.webp' where id = 'ex-mov-05';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/bench-couch-stretch-main.webp' where id = 'ex-mov-06';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/deep-squat-hold-main.webp' where id = 'ex-mov-07';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/bench-ankle-stretch-main.webp' where id = 'ex-mov-08';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/kneeling-hip-flexor-stretch-main.webp' where id = 'ex-mov-12';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/pigeon-stretch-main.webp' where id = 'ex-mov-13';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/standing-calf-stretch-main.webp' where id = 'ex-mov-15';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/bird-dog-hold-main.webp' where id = 'ex-cor-04';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/hollow-body-hold-main.webp' where id = 'ex-cor-05';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/v-ups-start.webp' where id = 'ex-cor-06';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/hanging-knee-raise-start.webp' where id = 'ex-cor-17';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/medicine-ball-slam-start.webp' where id = 'ex-agi-11';
update public.exercise_library set image_url = 'https://exercise-dataset.com/images/flat/kettlebell-overhead-carry-main.webp' where id = 'ex-agi-20';
select count(*) as con_imagen from public.exercise_library where image_url <> '';
commit;
