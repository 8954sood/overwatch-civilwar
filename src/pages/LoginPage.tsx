import { useState } from 'react'
import { adminLogin } from '../api/auctionApi'

export default function LoginPage() {
  const [adminId, setAdminId] = useState('admin')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    if (!adminId || !password) {
      alert('아이디와 비밀번호를 입력하세요.')
      return
    }
    try {
      const { token } = await adminLogin(adminId, password)
      localStorage.setItem('adminToken', token)
      window.location.hash = '#/dashboard'
    } catch (error) {
      alert('로그인에 실패했습니다.')
    }
  }

  return (
    <div className="page centered login-page">
      <div className="login-card">
        <h1>AUCTION ADMIN</h1>
        <div className="input-group">
          <label>ID</label>
          <input
            type="text"
            placeholder="admin"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
          />
        </div>
        <div className="input-group">
          <label>PASSWORD</label>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="btn-login" onClick={handleLogin}>
          LOGIN →
        </button>
        <div className="footer">CHZZK OVERWATCH AUCTION SYSTEM</div>
      </div>
    </div>
  )
}
