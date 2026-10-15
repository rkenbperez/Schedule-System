import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/login/Login';
import TeacherLayout from './layouts/TeacherLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboardPage';
import TeacherCoursesPage from './pages/teacher/TeacherCoursesPage';
import CreateSchedulePage from './pages/teacher/CreateSchedulePage';
import TeacherCourseDetailsPage from './pages/teacher/TeacherCourseDetailsPage';
import TeacherSchedulesPage from './pages/teacher/TeacherSchedulesPage';
import RegistrarLayout from './layouts/RegistrarLayout';
import RegistrarDashboardPage from './pages/registrar/RegistrarDashboardPage';
import RegistrarTeacherList from './pages/registrar/RegistrarTeacherList';
import RegistrarTeacherAssigment from './pages/registrar/RegistrarTeacherAssigment';
import RegistrarAssigments from './pages/registrar/RegistrarAssigments';

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
    element: <RegistrarLayout />,
    children: [
      {
        path: 'registrar/:name',
        element: <RegistrarDashboardPage />,
      },
      {
        path: 'teacher-list',
        element: <RegistrarTeacherList />,
      },
      {
        path: 'assignments',
        element: <RegistrarAssigments />,
      },
      {
        path: 'teacher-assigment/:teacherId',
        element: <RegistrarTeacherAssigment />,
      },
    ],
  },
]);

export default Router;
