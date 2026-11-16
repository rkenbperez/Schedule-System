import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/login/Login';
import TeacherLayout from './layouts/TeacherLayout';
import RegistrarLayout from './layouts/RegistrarLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboardPage';
import TeacherAssignmentPage from './pages/teacher/TeacherAssignmentPage';
import TeacherAssingmentDetailPage from './pages/teacher/TeacherAssingmentDetailPage';
import TeacherRoomDetailPage from './pages/teacher/TeacherRoomDetailPage';
import TeacherRoomPage from './pages/teacher/TeacherRoomPage';
import TeacherSchedulesPage from './pages/teacher/TeacherSchedulesPage';
import StudentScheduleLookupPage from './pages/student/StudentScheduleLookupPage';
import RegistrarDashboardPage from './pages/registrar/RegistrarDashboardPage';
import RegistrarScheduleManagementPage from './pages/registrar/RegistrarScheduleManagementPage';
import RegistrarTeacherList from './pages/registrar/RegistrarCreateSchedule';
import RegistrarTeacherAssignment from './pages/registrar/RegistrarTeacherAssignment';

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
        path: 'assignments',
        element: <TeacherAssignmentPage />,
      },
      {
        path: 'schedules',
        element: <TeacherSchedulesPage />,
      },
      {
        path: 'rooms',
        element: <TeacherRoomPage />,
      },
      {
        path: 'rooms/:roomId',
        element: <TeacherRoomDetailPage />,
      },
      {
        path: 'assignments/:assignment-id',
        element: <TeacherAssingmentDetailPage />,
      },
    ],
  },
  {
    path: '/registrar',
    element: <RegistrarLayout />,
    children: [
      {
        index: true,
        element: <RegistrarDashboardPage />,
      },
      {
        path: 'schedule-management',
        element: <RegistrarScheduleManagementPage />,
      },
      {
        path: 'teachers',
        element: <RegistrarTeacherList />,
      },
      {
        path: 'teachers/:teacherId',
        element: <RegistrarTeacherAssignment />,
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
