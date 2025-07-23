@extends('layouts.app')

@section('content')
<div class="space-y-6">
    <!-- Lead Analytics -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Lead Analytics</h2>
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Status</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Count</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @if (!empty($leadAnalytics))
                        @foreach (['NEW', 'IN_PROCESS', 'CONVERTED', 'LOST'] as $status)
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td class="px-6 py-4 dark:text-white">{{ $status }}</td>
                                <td class="px-6 py-4 dark:text-white">{{ $leadAnalytics[$status] ?? 0 }}</td>
                            </tr>
                        @endforeach
                    @else
                        <tr>
                            <td colspan="2" class="px-6 py-4 text-center dark:text-white">
                                Không có dữ liệu lead analytics: {{ session('error') ?? 'Kiểm tra log server' }}
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>

    <!-- Deal Analytics -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Deal Analytics</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Metric</th>
                            <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Value</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td class="px-6 py-4 dark:text-white">Conversion Rate</td>
                            <td class="px-6 py-4 dark:text-white">{{ number_format(($dealAnalytics['conversionRate'] ?? 0) * 100, 2) }}%</td>
                        </tr>
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td class="px-6 py-4 dark:text-white">Total Revenue</td>
                            <td class="px-6 py-4 dark:text-white">{{ number_format($dealAnalytics['revenue'] ?? 0, 2) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            @if (!empty($dealAnalytics['revenueByDay']))
                <div>
                    <canvas id="revenueByDayChart" class="h-64"></canvas>
                </div>
            @endif
        </div>
    </div>

    <!-- Task Analytics -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Task Analytics</h2>
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Responsible ID</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Completed Tasks</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @if (!empty($taskAnalytics))
                        @foreach ($taskAnalytics as $responsibleId => $completedTasks)
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td class="px-6 py-4 dark:text-white">{{ $responsibleId }}</td>
                                <td class="px-6 py-4 dark:text-white">{{ $completedTasks }}</td>
                            </tr>
                        @endforeach
                    @else
                        <tr>
                            <td colspan="2" class="px-6 py-4 text-center dark:text-white">
                                Không có dữ liệu task analytics: {{ session('error') ?? 'Kiểm tra log server' }}
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
</div>

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js"></script>
<script>
    document.addEventListener("DOMContentLoaded", function () {
        const ctx = document.getElementById('revenueByDayChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: @json(array_column($dealAnalytics['revenueByDay'], 'date')),
                    datasets: [{
                        label: 'Doanh thu theo ngày',
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
                            beginAtZero: true,
                            title: { display: true, text: 'Doanh thu', color: '#ffffff' }
                        },
                        x: {
                            title: { display: true, text: 'Ngày', color: '#ffffff' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        },
                        title: {
                            display: true,
                            text: 'Doanh thu dự kiến',
                            color: '#ffffff'
                        }
                    }
                }
            });
        }
    });
</script>
@endpush
@endsection