import React, { useState } from 'react'
import axios from 'axios';
import "../Style/Login.css"
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Login = () => {

  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://127.0.0.1:3000/login", { code }, { withCredentials: true });
      localStorage.setItem("token", res.data.token);
      navigate("/");
    } catch (error) {
      toast.error("Código incorreto", { autoClose: 5000 })
    }
  }

  return (
    <div>
      <div className='login_container'>
        <button id='info_btn_login_page' onClick={() => toast.info("Não possui o código? Solicite para alguém da sua equipe", {autoClose:5000})}>?</button>
        <h1 id='login_page_title'>Insira o código de verificação</h1>
        <form onSubmit={handleSubmit}>
          <input type='password' autoFocus placeholder='Digite e pressione enter' onChange={(e) => setCode(e.target.value)} />
          <button className='login_page_btn_submit' type='submit'>Entrar</button>
        </form>
      </div>
    </div>
  )
}

export default Login