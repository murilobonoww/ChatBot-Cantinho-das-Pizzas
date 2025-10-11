import React, { useState } from 'react'
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {

  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://127.0.0.1:3000/login", { code }, { withCredentials: true });
      localStorage.setItem("token", res.data.token);
      navigate("/");
    } catch (error) {
      setError(`${error}`);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {error && <p>{error}</p>}
        <input type='text' placeholder='código' onChange={(e) => setCode(e.target.value)} />
        <button type='submit'>Entrar</button>
      </form>
    </div>
  )
}

export default Login