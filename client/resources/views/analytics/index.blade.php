<!DOCTYPE html>
<html>

<head>
    <title>Analytics</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js"></script>
</head>

<body class="bg-gray-100 dark:bg-gray-900">
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4 dark:text-white">Analytics Dashboard</h1>

        @if (session('error'))
            <div class="bg-red-500 text-white p-4 rounded mb-4">
                {{ session('error') }}
            </div>
        @endif

        @php
            $leadAnalytics = $leadAnalytics ?? [];
            $dealAnalytics = $dealAnalytics ?? [];
            $taskAnalytics = $taskAnalytics ?? [];

            $dealAnalytics = array_merge([
                'conversionRate' => 0,
                'revenue' => 0,
                'revenueByDay' => [],
            ], $dealAnalytics);
        @endphp

        <!-- Lead Analytics -->
        <div class="mb-8">
            <h2 class="text-xl font-semibold mb-2 dark:text-white">Lead Analytics</h2>
            <table class="min-w-full bg-white dark:bg-gray-800">
                <thead>
                    <tr>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Status</th>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Count</th>
                    </tr>
                </thead>
                <tbody>
                    @if (!empty($leadAnalytics))
                        @foreach (['NEW', 'IN_PROGRESS', 'CONVERTED', 'LOST'] as $status)
                            <tr class="dark:bg-gray-800">
                                <td class="p-2 dark:text-white">{{ $status }}</td>
                                <td class="p-2 dark:text-white">{{ $leadAnalytics[$status] ?? 0 }}</td>
                            </tr>
                        @endforeach
                    @else
                        <tr>
                            <td colspan="2" class="p-2 text-center dark:text-white">
                                Không có dữ liệu lead analytics: {{ session('error') ?? 'Kiểm tra log server' }}
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>

        <!-- Deal Analytics -->
        <div class="mb-8">
            <h2 class="text-xl font-semibold mb-2 dark:text-white">Deal Analytics</h2>
            <table class="min-w-full bg-white dark:bg-gray-800">
                <thead>
                    <tr>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Metric</th>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="dark:bg-gray-800">
                        <td class="p-2 dark:text-white">Conversion Rate</td>
                        <td class="p-2 dark:text-white">
                            {{ number_format(($dealAnalytics['conversionRate'] ?? 0) * 100, 2) }}%
                        </td>
                    </tr>
                    <tr class="dark:bg-gray-800">
                        <td class="p-2 dark:text-white">Total Revenue</td>
                        <td class="p-2 dark:text-white">{{ number_format($dealAnalytics['revenue'] ?? 0, 2) }}</td>
                    </tr>
                </tbody>
            </table>

            @if (!empty($dealAnalytics['revenueByDay']))
                <div class="mt-4">
                    <canvas id="revenueByDayChart"></canvas>
                </div>
                <script>
                    document.addEventListener("DOMContentLoaded", function () {
                        const ctx = document.getElementById('revenueByDayChart');

                        if (ctx) {
                            new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: @json(array_column($dealAnalytics['revenueByDay'], 'date')),
                                    datasets: [{
                                        label: 'Revenue by Day',
                                        data: @json(array_column($dealAnalytics['revenueByDay'], 'revenue')),
                                        borderColor: '#3b82f6',
                                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                        fill: true,
                                        tension: 0.4
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: {
                                            beginAtZero: true
                                        }
                                    },
                                    plugins: {
                                        legend: {
                                            labels: {
                                                color: '#ffffff'
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                </script>
            @endif
        </div>

        <!-- Task Analytics -->
        <div class="mb-8">
            <h2 class="text-xl font-semibold mb-2 dark:text-white">Task Analytics</h2>
            <table class="min-w-full bg-white dark:bg-gray-800">
                <thead>
                    <tr>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Responsible ID</th>
                        <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Completed Tasks</th>
                    </tr>
                </thead>
                <tbody>
                    @if (!empty($taskAnalytics))
                        @foreach ($taskAnalytics as $responsibleId => $completedTasks)
                            <tr class="dark:bg-gray-800">
                                <td class="p-2 dark:text-white">{{ $responsibleId }}</td>
                                <td class="p-2 dark:text-white">{{ $completedTasks }}</td>
                            </tr>
                        @endforeach
                    @else
                        <tr>
                            <td colspan="2" class="p-2 text-center dark:text-white">
                                Không có dữ liệu task analytics: {{ session('error') ?? 'Kiểm tra log server' }}
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
</body>

</html>