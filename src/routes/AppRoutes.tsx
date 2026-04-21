import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Loading from "../pages/Loading";

import { ProtectedRoute } from '../components/ProtectedRoute';

const Home = lazy(() => import("../pages/Home"));
const RoomEntry = lazy(() => import("../pages/RoomEntry"));
const VideoCall = lazy(() => import("../components/VideoCall/VideoCall"));
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));

export default function AppRoutes() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                {/* Home: auto-creates room, shows signup modal, then room-ready popup */}
                <Route path="/" element={<Home />} />
                <Route path='/load' element={<Loading />} />
                <Route path='/login' element={<Login />} />
                <Route path='/signup' element={<Signup />} />

                {/* Protected studio routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path='/room' element={<RoomEntry />} />
                  <Route path='/room/:roomId' element={<VideoCall />} />
                </Route>
            </Routes>
        </Suspense>
    );
}