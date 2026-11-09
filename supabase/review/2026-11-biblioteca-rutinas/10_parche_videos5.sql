-- ==========================================================================
-- Parche final: video YouTube (búsqueda) para los 5 sin foto libre
-- Ejecutar en SQL Editor después del 01,04,06,08
-- ==========================================================================
begin;
update public.exercise_library set video_url = 'https://www.youtube.com/results?search_query=heisman+steps+football+drill' where id = 'ex-car-18';
update public.exercise_library set video_url = 'https://www.youtube.com/results?search_query=broad+jump+technique' where id = 'ex-agi-02';
update public.exercise_library set video_url = 'https://www.youtube.com/results?search_query=cone+drills+agility' where id = 'ex-agi-14';
update public.exercise_library set video_url = 'https://www.youtube.com/results?search_query=backpedal+running+drill' where id = 'ex-agi-16';
update public.exercise_library set video_url = 'https://www.youtube.com/results?search_query=deceleration+drill+stop+start' where id = 'ex-agi-17';
commit;
