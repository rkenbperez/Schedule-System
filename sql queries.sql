-- ============================================================
-- Seed data for the Scheduling System
-- Run this whole script once in pgAdmin or via Django, in order.
-- Login: teacher@example.com / password123  (teacher)
--        admin@example.com  / password123  (admin)
-- ============================================================

-- ============================================================
-- 1) USERS (password123 for both)
-- ============================================================
INSERT INTO accounts_user
(id, password, last_login, is_superuser, username, first_name, last_name,
 email, is_staff, is_active, date_joined, role)
VALUES
(1, 'pbkdf2_sha256$1000000$LwR32fcTHwBrpW7IvJkB4D$CW1o7J1L0iiBVI0HjQjD0GFanMmedhaZ9N2E2YCiZJ4=',
 NULL, FALSE, 'admin', '', '', 'admin@example.com', TRUE, TRUE, NOW(), 'admin'),
(2, 'pbkdf2_sha256$1000000$LwR32fcTHwBrpW7IvJkB4D$CW1o7J1L0iiBVI0HjQjD0GFanMmedhaZ9N2E2YCiZJ4=',
 NULL, FALSE, 'teacher', '', '', 'teacher@example.com', FALSE, TRUE, NOW(), 'teacher');

-- ============================================================
-- 2) TEACHER PROFILE
-- ============================================================
INSERT INTO accounts_teacher (id, employee_no, full_name, is_active, user_id)
VALUES (1, 'EMP-2026-001', 'Angel Cruz', TRUE, 2);

-- ============================================================
-- 3) ROOM TYPES
-- ============================================================
INSERT INTO rooms_roomtype (id, name)
VALUES (1, 'lecture'), (2, 'laboratory');

-- ============================================================
-- 4) ROOMS
-- ============================================================
INSERT INTO rooms_room (id, code, room_type_id, capacity, is_active, created_at)
VALUES
(101, 'Room 101', 1, 40, TRUE, NOW()),
(102, 'Room 204', 1, 35, TRUE, NOW()),
(103, 'Lab 202', 2, 30, TRUE, NOW());

-- ============================================================
-- 5) ACADEMIC TERM
-- ============================================================
INSERT INTO academics_academicterm
(id, name, school_year, term_type, start_date, end_date, is_active, created_at)
VALUES
(1, '1st Semester', '2026-2027', 'regular', '2026-08-01', '2026-12-20', TRUE, NOW());

-- ============================================================
-- 6) COURSES
-- ============================================================
INSERT INTO academics_course (id, code, title, units, is_active, created_at)
VALUES
(1, 'COSC 7',   'Data Structures and Algorithms', 3.0, TRUE, NOW()),
(2, 'DCIT 5',   'Database Management Systems',    3.0, TRUE, NOW()),
(3, 'MATH 10',  'Calculus II',                     4.0, TRUE, NOW());

-- ============================================================
-- 7) COURSE COMPONENTS (lecture = 2h, laboratory = 4h)
-- ============================================================
INSERT INTO academics_coursecomponent
(id, course_id, room_type_id, label, duration, is_active, created_at)
VALUES
(1, 1, 1, 'lecture',    2, TRUE, NOW()),
(2, 1, 2, 'laboratory', 4, TRUE, NOW()),
(3, 2, 1, 'lecture',    2, TRUE, NOW()),
(4, 2, 2, 'laboratory', 4, TRUE, NOW()),
(5, 3, 1, 'lecture',    2, TRUE, NOW());

-- ============================================================
-- 8) SECTIONS
-- ============================================================
INSERT INTO academics_section
(id, code, program, year_level, student_count, academic_term_id, is_active, created_at)
VALUES
(1, '3-A', 'BSIT', 3, 30, 1, TRUE, NOW()),
(2, '2-B', 'BSIT', 2, 28, 1, TRUE, NOW());

-- ============================================================
-- 9) COURSE ASSIGNMENTS (teacher teaches course to section)
-- ============================================================
INSERT INTO scheduling_courseassignment
(id, academic_term_id, teacher_id, course_id, section_id, is_active, created_at)
VALUES
(1, 1, 1, 1, 1, TRUE, NOW()),  -- COSC 7  -> 3-A
(2, 1, 1, 2, 2, TRUE, NOW()),  -- DCIT 5  -> 2-B
(3, 1, 1, 3, 1, TRUE, NOW());  -- MATH 10 -> 3-A

-- ============================================================
-- 10) SCHEDULES  (day_of_week: 0=Mon..4=Fri)
-- one per teacher/section/room per day
-- ============================================================
INSERT INTO scheduling_schedule
(id, course_assignment_id, course_component_id, academic_term_id, teacher_id,
 section_id, room_id, start_time, end_time, day_of_week, is_active, created_at)
VALUES
(1, 1, 1, 1, 1, 1, 101, '07:00:00', '09:00:00',  0, TRUE, NOW()), -- COSC 7  lec Mon   Room 101
(2, 3, 5, 1, 1, 1, 102, '07:00:00', '09:00:00',  1, TRUE, NOW()), -- MATH 10 lec Tue   Room 204
(3, 1, 2, 1, 1, 1, 103, '13:00:00', '17:00:00',  2, TRUE, NOW()), -- COSC 7  lab Wed   Lab 202
(4, 2, 3, 1, 1, 2, 101, '07:00:00', '09:00:00',  3, TRUE, NOW()), -- DCIT 5  lec Thu   Room 101
(5, 2, 4, 1, 1, 2, 103, '13:00:00', '17:00:00',  4, TRUE, NOW()); -- DCIT 5  lab Fri   Lab 202

-- ============================================================
-- 11) FIX SEQUENCES (so future Django inserts don't collide)
-- ============================================================
SELECT setval('accounts_user_id_seq',                   (SELECT max(id) FROM accounts_user));
SELECT setval('accounts_teacher_id_seq',                (SELECT max(id) FROM accounts_teacher));
SELECT setval('rooms_roomtype_id_seq',                  (SELECT max(id) FROM rooms_roomtype));
SELECT setval('rooms_room_id_seq',                      (SELECT max(id) FROM rooms_room));
SELECT setval('academics_academicterm_id_seq',          (SELECT max(id) FROM academics_academicterm));
SELECT setval('academics_course_id_seq',                (SELECT max(id) FROM academics_course));
SELECT setval('academics_coursecomponent_id_seq',       (SELECT max(id) FROM academics_coursecomponent));
SELECT setval('academics_section_id_seq',               (SELECT max(id) FROM academics_section));
SELECT setval('scheduling_courseassignment_id_seq',     (SELECT max(id) FROM scheduling_courseassignment));
SELECT setval('scheduling_schedule_id_seq',             (SELECT max(id) FROM scheduling_schedule));