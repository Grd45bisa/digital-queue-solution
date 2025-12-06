import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import QueueSystem from './Pages/QueueSystem'
import Display from './Pages/Display'
import Teller from './Pages/Teller'
import QRCodePage from './Pages/QRCodePage'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<QueueSystem />} />
        <Route path='/QRcode' element={<QRCodePage />}/>
        <Route path="/display" element={<Display />} />
        <Route path="/teller" element={<Teller />} />
      </Routes>
    </Router>
  )
}

export default App
