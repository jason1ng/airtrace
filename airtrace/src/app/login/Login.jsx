// src/app/login/Login.jsx
import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);
      await login(emailRef.current.value, passwordRef.current.value);
      // Success! Go to the map
      navigate("/map");
    } catch (err) {
      setError("Failed to log in: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2 style={{ textAlign: "center" }}>Log In to AirTrace</h2>
      {error && <div style={{ background: "#ffdddd", color: "red", padding: "10px", marginBottom: "10px" }}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <input type="email" ref={emailRef} placeholder="Email" required style={{ padding: "10px" }} />
        <input type="password" ref={passwordRef} placeholder="Password" required style={{ padding: "10px" }} />
        
        <button disabled={loading} type="submit" style={{ padding: "10px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}>
          Log In
        </button>
      </form>
      
      <div style={{ marginTop: "15px", textAlign: "center" }}>
        Need an account? <Link to="/signup">Sign Up</Link>
      </div>
    </div>
  );
}