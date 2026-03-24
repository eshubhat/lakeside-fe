import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Loading from "../pages/Loading";

import { ProtectedRoute } from '../components/ProtectedRoute';

const LandingPage = lazy(() => import("../pages/Landing"));
const RoomEntry = lazy(() => import("../pages/RoomEntry"));
const VideoCall = lazy(() => import("../components/VideoCall/VideoCall"));
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));

export default function AppRoutes() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path='/load' element={<Loading />} />
                <Route path='/login' element={<Login />} />
                <Route path='/signup' element={<Signup />} />
                
                {/* Dynamically styled staging room replacing the instant navigator implicitly isolated */}
                <Route element={<ProtectedRoute />}>
                  <Route path='/room' element={<RoomEntry />} />
                  <Route path='/room/:roomId' element={<VideoCall />} />
                </Route>
            </Routes>
        </Suspense>
    );
}