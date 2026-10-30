import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

// pages
import Home from "./page/home";
import Question from "./page/question";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/question" element={<Question />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;