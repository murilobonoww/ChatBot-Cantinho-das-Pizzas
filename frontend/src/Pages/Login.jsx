import React, { useState } from 'react'
import axios from 'axios';
import "../Style/Login.css"
import hide_pass from "/assets/hide_password.png"
import show_pass from "/assets/show_password.png"
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const Login = () => {

  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

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
        <button id='info_btn_login_page' onClick={() => toast.info("Não possui o código? Solicite a alguém da sua equipe", {
          className: "custom-info-toast",
          progressClassName: "custom-info-progress"
        }, { autoClose: 5000 })}>?</button>
        <h1 id='login_page_title'>Insira o código de login</h1>
        <form className='login_form' onSubmit={handleSubmit}>

          <input type={show ? 'text' : 'password'} autoFocus placeholder='Digite e pressione enter' onChange={(e) => setCode(e.target.value)}/>

          <button type='button' id='btn_toggle_show_pass_login_page' onClick={() => setShow(prev => !prev)}>
            <img id='img_btn_toggle_show_pass_login_page' src={!show ? show_pass : hide_pass}/>
          </button>


          <button className='login_page_btn_submit' type='submit'>Entrar</button>
        </form>
      </div>
    </div>
  )
}

export default Login