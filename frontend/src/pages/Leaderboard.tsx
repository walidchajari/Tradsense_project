import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import LeaderboardContent from '@/components/leaderboard/LeaderboardContent';

const Leaderboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <LeaderboardContent />
      </main>

      <Footer />
    </div>
  );
};

export default Leaderboard;
