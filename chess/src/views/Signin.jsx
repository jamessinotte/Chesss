import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import styles from "../build/Auth.module.css";

const Signin = () => {
  const navigate = useNavigate(); // used to redirect after successful login

  // Stores email and password input values
  const [formData, setFormData] = useState({ email: "", password: "" });

  // Stores error message from failed login
  const [error, setError] = useState("");

  // Updates form state when user types
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent page refresh on submit
    try {
      // Send login request to backend
      const res = await api.post("/auth/signin", formData);

      // Save auth info for later use
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Redirect to home page after login
      navigate("/home");
    } catch (err) {
      // Show backend error or default message
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2>Sign In</h2>

      {/* Display error if login fails */}
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.authForm}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          required
        />

        <button type="submit">Sign In</button>
      </form>

      {/* Link to signup page */}
      <p>
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </p>
    </div>
  );
};

export default Signin;
