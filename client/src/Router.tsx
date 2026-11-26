import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from './pages/login/Login';
import ResetPasswordPage from './pages/login/ResetPasswordPage';
import TeacherLayout from './layouts/TeacherLayout';
import RegistrarLayout from './layouts/RegistrarLayout';
import StudentLayout from './layouts/StudentLayout';
import DepartmentHeadLayout from './layouts/DepartmentHeadLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboardPage';
import TeacherAssignmentPage from './pages/teacher/TeacherAssignmentPage';
import TeacherAssingmentDetailPage from './pages/teacher/TeacherAssingmentDetailPage';
import ProfessorPreferenceDashboard from './pages/teacher/ProfessorPreferenceDashboard';
import DepartmentHeadDashboard from './pages/department-head/DepartmentHeadDashboard';

import TeacherRoomPage from './pages/teacher/TeacherRoomPage';
import TeacherRoomDetailPage from './pages/teacher/TeacherRoomDetailPage';
import TeacherSchedulesPage from './pages/teacher/TeacherSchedulesPage';
import TeacherProfilePage from './pages/teacher/TeacherProfilePage';
import TeacherDepartmentPage from './pages/teacher/DepartmentPage';
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
        path: 'preferences',
        element: (
          <RequireAuth requiredRole='professor'>
            <ProfessorPreferenceDashboard />
          </RequireAuth>
        ),
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
        path: 'assignments/:assignment-id',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherAssingmentDetailPage />
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
        path: 'rooms/:roomId',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherRoomDetailPage />
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
      {
        path: 'department',
        element: (
          <RequireAuth requiredRole='professor'>
            <TeacherDepartmentPage />
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
        element: <Navigate to='/registrar' replace />,
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
    path: '/department-head',
    element: (
      <RequireAuth requiredRole='registrar'>
        <DepartmentHeadLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <DepartmentHeadDashboard />,
      },
      {
        path: 'submissions',
        element: <DepartmentHeadDashboard />,
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
