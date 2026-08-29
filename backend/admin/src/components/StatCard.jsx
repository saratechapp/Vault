import { Card, CardContent, Typography, Skeleton, Box } from '@mui/material';

export function StatCard({ label, value, loading, tone }) {
  const color = tone === 'danger' ? 'error.main' : tone === 'warning' ? 'warning.main' : 'text.primary';
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {loading ? (
            <Skeleton width={60} height={36} />
          ) : (
            <Typography variant="h4" sx={{ fontWeight: 700, color }}>{value}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default StatCard;
