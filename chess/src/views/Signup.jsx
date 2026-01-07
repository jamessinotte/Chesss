import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import styles from "../build/Auth.module.css";

const Signup = () => {
  const navigate = useNavigate(); // used to redirect after signup

  // Stores username, email, and password inputs
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: ""
  });

  // Stores error message if signup fails
  const [error, setError] = useState("");

  // Updates form data when user types
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent page reload
    try {
      // Send signup request to backend
      const res = await api.post("/auth/signup", formData);

      // Save auth info for later use
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Go to home page after successful signup
      navigate("/home");
    } catch (err) {
      // Show backend error or default message
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2>Sign Up</h2>

      {/* Display error if signup fails */}
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.authForm}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          onChange={handleChange}
          required
        />

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

        <button type="submit">Sign Up</button>
      </form>

      {/* Link to sign-in page */}
      <p>
        Already have an account? <Link to="/signin">Sign In</Link>
      </p>
    </div>
  );
};

export default Signup;
