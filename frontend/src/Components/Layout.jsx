import SideBar from "./SideBar";
import { Outlet } from "react-router-dom";
import '../Style/Layout.css'
import { useState } from "react";

export default function Layout() {
    const [isNotifBarOpened, setIsNotifBarOpened] = useState(false)
    return (
        <div className="layout">
            <SideBar
                isNotifBarOpened={isNotifBarOpened}
                setIsNotifBarOpened={setIsNotifBarOpened} />

            <main style={{ flex: 1, display: 'flex', justifyContent: 'start' }}>
                <Outlet context={{
                    isNotifBarOpened,
                    setIsNotifBarOpened
                }} />
            </main>
        </div>
    )
}