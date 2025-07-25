@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        @if (session('error'))
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                {{ session('error') }}
            </div>
        @endif
        @if (session('success'))
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                {{ session('success') }}
            </div>
        @endif

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
                                    <td class="px-6 py-4 dark:text-white">{{ e($status) }}</td>
                                    <td class="px-6 py-4 dark:text-white">{{ e($leadAnalytics[$status] ?? 0) }}</td>
                                </tr>
                            @endforeach
                        @else
                            <tr>
                                <td colspan="2" class="px-6 py-4 text-center dark:text-white">
                                    Không có dữ liệu lead analytics: {{ e(session('error') ?? 'Kiểm tra log server') }}
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
                                <td class="px-6 py-4 dark:text-white">
                                    {{ e(number_format(($dealAnalytics['conversionRate'] ?? 0) * 100, 2)) }}%
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td class="px-6 py-4 dark:text-white">Total Revenue</td>
                                <td class="px-6 py-4 dark:text-white">
                                    {{ e(number_format($dealAnalytics['revenue'] ?? 0, 2)) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                @if (!empty($dealAnalytics['revenueByDay']) && is_array($dealAnalytics['revenueByDay']))
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
                                    <td class="px-6 py-4 dark:text-white">{{ e($responsibleId) }}</td>
                                    <td class="px-6 py-4 dark:text-white">{{ e($completedTasks) }}</td>
                                </tr>
                            @endforeach
                        @else
                            <tr>
                                <td colspan="2" class="px-6 py-4 text-center dark:text-white">
                                    Không có dữ liệu task analytics: {{ e(session('error') ?? 'Kiểm tra log server') }}
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
                    try {
                        const data = {
                            labels: @json(array_column($dealAnalytics['revenueByDay'] ?? [], 'date')),
                            datasets: [{
                                label: 'Doanh thu theo ngày',
                                data: @json(array_column($dealAnalytics['revenueByDay'] ?? [], 'revenue')),
                                borderColor: '#2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.3)',
                                fill: true,
                                tension: 0.4
                            }]
                        };

                        if (!data.labels.length || !data.datasets[0].data.length) {
                            console.warn('No revenueByDay data available');
                            ctx.style.display = 'none';
                            return;
                        }

                        new Chart(ctx, {
                            type: 'line',
                            data: data,
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: { display: true, text: 'Doanh thu', color: '#1f2937' },
                                        ticks: { color: '#1f2937' }
                                    },
                                    x: {
                                        title: { display: true, text: 'Ngày', color: '#1f2937' },
                                        ticks: { color: '#1f2937' }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        labels: { color: '#1f2937' }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Doanh thu dự kiến',
                                        color: '#1f2937'
                                    }
                                }
                            }
                        });
                    } catch (error) {
                        console.error('Failed to render revenueByDay chart:', error);
                        ctx.style.display = 'none';
                    }
                }
            });
        </script>
    @endpush
@endsection