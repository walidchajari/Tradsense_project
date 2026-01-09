import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LeaderboardContent from '@/components/leaderboard/LeaderboardContent';

const DashboardLeaderboard = () => (
  <DashboardLayout>
    <LeaderboardContent inDashboard showCta={false} />
  </DashboardLayout>
);

export default DashboardLeaderboard;
