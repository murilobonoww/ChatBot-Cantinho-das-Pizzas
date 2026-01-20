import SideBar from "./SideBar";
import { Outlet } from "react-router-dom";
import '../Style/Layout.css'

export default function Layout() {
    return(
        <div className="layout">
            <SideBar />
            <main style={{ flex: 1, marginLeft: 250, display: 'flex', justifyContent: 'center' }}>
                <Outlet />
            </main>
        </div>
    )
}