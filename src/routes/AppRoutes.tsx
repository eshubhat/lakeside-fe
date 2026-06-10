import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Loading from "../pages/Loading";

import { ProtectedRoute } from '../components/ProtectedRoute';

const Home = lazy(() => import("../pages/Home"));
const RoomEntry = lazy(() => import("../pages/RoomEntry"));
const VideoCall = lazy(() => import("../components/VideoCall/VideoCall"));
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));
const History = lazy(() => import("../pages/History"));
const EditorImport = lazy(() => import("../pages/Editor"));
const VideoEditor = lazy(() => import("../pages/VideoEditor"));

export default function AppRoutes() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                {/* Public auth routes */}
                <Route path='/login' element={<Login />} />
                <Route path='/signup' element={<Signup />} />
                <Route path='/load' element={<Loading />} />

                {/* All authenticated routes */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Home />} />
                    <Route path='/room' element={<RoomEntry />} />
                    <Route path='/room/:roomId' element={<VideoCall />} />
                    <Route path='/history' element={<History />} />
                    <Route path='/editor' element={<EditorImport />} />
                    <Route path='/editor/:projectId' element={<VideoEditor />} />
                </Route>

                {/* Catch-all → login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Suspense>
    );
}