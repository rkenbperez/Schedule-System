import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/login/Login';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboardPage';
import TeacherCoursesPage from './pages/teacher/TeacherCoursesPage';
import CreateSchedulePage from './pages/teacher/CreateSchedulePage';
import TeacherCourseDetailsPage from './pages/teacher/TeacherCourseDetailsPage';
import TeacherSchedulesPage from './pages/teacher/TeacherSchedulesPage';
import StudentScheduleLookupPage from './pages/student/StudentScheduleLookupPage';

const Router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/teacher/:name',
    element: <TeacherLayout />,
    children: [
      {
        index: true,
        element: <TeacherDashboard />,
      },
      {
        path: 'courses',
        element: <TeacherCoursesPage />,
      },
      {
        path: 'schedules',
        element: <TeacherSchedulesPage />,
      },
      {
        path: ':course-assigment-id',
        element: <TeacherCourseDetailsPage />,
      },
      {
        path: 'create-schedule/:course-assigment-id',
        element: <CreateSchedulePage />,
      },
    ],
  },
  {
    path: '/student',
    element: <StudentLayout />,
    children: [
      {
        index: true,
        element: <StudentScheduleLookupPage />,
      },
    ],
  },
]);

export default Router;
