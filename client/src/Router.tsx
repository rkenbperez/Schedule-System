import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/login/Login';
import ResetPasswordPage from './pages/login/ResetPasswordPage';
import TeacherLayout from './layouts/TeacherLayout';
import RegistrarLayout from './layouts/RegistrarLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboardPage';
import TeacherAssignmentPage from './pages/teacher/TeacherAssignmentPage';

import TeacherRoomPage from './pages/teacher/TeacherRoomPage';
import TeacherSchedulesPage from './pages/teacher/TeacherSchedulesPage';
import TeacherProfilePage from './pages/teacher/TeacherProfilePage';
import StudentScheduleLookupPage from './pages/student/StudentScheduleLookupPage';
import RegistrarDashboardPage from './pages/registrar/RegistrarDashboardPage';
import RegistrarScheduleManagementPage from './pages/registrar/RegistrarScheduleManagementPage';
import RegistrarTeacherList from './pages/registrar/RegistrarCreateSchedule';
import RegistrarTeacherAssignment from './pages/registrar/RegistrarTeacherAssignment';
import RegistrarTimetablePage from './pages/registrar/RegistrarTimetablePage';
import RegistrarMasterDataPage from './pages/registrar/RegistrarMasterDataPage';
import EngineTestPage from './pages/registrar/EngineTestPage';
import { RequireAuth } from './components/shared/RequireAuth';
import NotFound from './pages/NotFound';

const Router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/teacher/:name',
    element: (
      <RequireAuth requiredRole='professor'>
        <TeacherLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <TeacherDashboard />,
      },
      {
        path: 'assignments',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherAssignmentPage />
          </RequireAuth>
        ),
      },
      {
        path: 'schedules',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherSchedulesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'rooms',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherRoomPage />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherProfilePage />
          </RequireAuth>
        ),
      },
    ],
  },
  {
    path: '/registrar',
    element: (
      <RequireAuth requiredRole='registrar'>
        <RegistrarLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <RegistrarDashboardPage />,
      },
      {
        path: 'dashboard',
        element: <RegistrarDashboardPage />,
      },
      {
        path: 'schedule-management',
        element: (
          <RequireAuth requiredRole='registrar'>
            <RegistrarScheduleManagementPage />
          </RequireAuth>
        ),
      },
      {
        path: 'teachers',
        element: (
          <RequireAuth requiredRole='registrar'>
            <RegistrarTeacherList />
          </RequireAuth>
        ),
      },
      {
        path: 'teachers/:teacherId',
        element: (
          <RequireAuth requiredRole='registrar'>
            <RegistrarTeacherAssignment />
          </RequireAuth>
        ),
      },
      {
        path: 'engine-test',
        element: (
          <RequireAuth requiredRole='registrar'>
            <EngineTestPage />
          </RequireAuth>
        ),
      },
      {
        path: 'timetable',
        element: (
          <RequireAuth requiredRole='registrar'>
            <RegistrarTimetablePage />
          </RequireAuth>
        ),
      },
      {
        path: 'master-data',
        element: (
          <RequireAuth requiredRole='registrar'>
            <RegistrarMasterDataPage />
          </RequireAuth>
        ),
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
  {
    path: '*',
    element: <NotFound />,
  },
]);

export default Router;
