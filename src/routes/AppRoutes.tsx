import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Loading from "../pages/Loading";

const LandingPage = lazy(() => import("../pages/Landing"));
const RoomEntry = lazy(() => import("../pages/RoomEntry"));
const VideoCall = lazy(() => import("../components/VideoCall/VideoCall"));

export default function AppRoutes() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path='/load' element={<Loading />} />
                
                {/* Dynamically styled staging room replacing the instant navigator */}
                <Route path='/room' element={<RoomEntry />} />
                <Route path='/room/:roomId' element={<VideoCall />} />
            </Routes>
        </Suspense>
    );
}