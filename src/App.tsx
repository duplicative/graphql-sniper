import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FuzzerProvider } from './FuzzerContext'
import GraphQLPage from './GraphQLPage'
import Fuzzer from './Fuzzer'

export default function App() {
  return (
    <FuzzerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GraphQLPage />} />
          <Route path="/fuzzer" element={<Fuzzer />} />
        </Routes>
      </BrowserRouter>
    </FuzzerProvider>
  )
}
