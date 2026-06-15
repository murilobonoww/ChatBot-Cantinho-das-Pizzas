import { useNavigate } from 'react-router-dom';
import '../Style/ManagerAuth.css';
import warning_icon from '../assets/icons/warning.webp';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function ManagerAuth({ method, closeModal, openChange, handleDeletePedido, isNotifBarOpened }) {

    const navigate = useNavigate();
    const [authPass, setAuthPass] = useState("");

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            confirmAuthPass(authPass, method);
        }
    }

    async function confirmAuthPass(pass, method) {
        try {
            const res = await axios.post(`https://back-cantinho-das-pizzas.onrender.com/auth/confirmPass/${pass}`, {}, { withCredentials: true })

            if (method === "change") {
                openChange();
            }
            else if (method === "delete") {
                handleDeletePedido();
            }
            else if (method === "report") {
                navigate("/relatorios");
            }
            closeModal()
        }
        catch (error) {
            if (error.response) {

                if (error.response.status === 404) {
                    console.log("rota não encontrada")
                }

                else if (error.response.status === 401) {
                    toast.error("Senha incorreta", { autoClose: 4000 })
                    console.log("unauthorizated")
                }
            }
        }
    }

    return (
        <div className={`auth_tela_pedidos ${isNotifBarOpened ? 'whenNotifBarOpened' : 'whenNotifBar_NOT_Opened'}`}>
            <img src={warning_icon} style={{ width: "50px" }} />
            <h1 id="title_auth_tela_pedidos">Ação restrita à gerência</h1>
            <input placeholder="Digite a senha" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => handleKeyDown(e)} autoFocus className="input_auth_tela_pedidos" />
            <button id="btn_confirm_auth_pass" onClick={() => confirmAuthPass(authPass, method)}>Entrar</button>
        </div>
    )
}