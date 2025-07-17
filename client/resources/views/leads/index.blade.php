@extends('layouts.app')

@section('content')
    <div class="container mx-auto p-6">
        <h1 class="text-2xl font-bold mb-4">Danh sách Lead</h1>

        @if(session('success'))
            <div class="bg-green-100 text-green-800 p-2 rounded mb-4">
                {{ session('success') }}
            </div>
        @endif

        @if($errors->any())
            <div class="bg-red-100 text-red-800 p-2 rounded mb-4">
                {{ $errors->first() }}
            </div>
        @endif

        <div class="flex justify-between items-center mb-4">
            <a href="{{ url('/leads/create') }}" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                + Thêm Lead
            </a>
            <button onclick="fetchLeads()" class="bg-gray-200 px-3 py-1 rounded text-sm">
                Tải lại danh sách
            </button>
        </div>

        <table class="table-auto w-full border mt-4">
            <thead>
                <tr class="bg-gray-200">
                    <th class="px-4 py-2">ID</th>
                    <th class="px-4 py-2">Tiêu đề</th>
                    <th class="px-4 py-2">Trạng thái</th>
                    <th class="px-4 py-2">Hành động</th>
                </tr>
            </thead>
            <tbody id="lead-table-body">
                @include('leads.partials.lead-rows', ['leads' => $leads])
            </tbody>
        </table>
    </div>
@endsection

@push('scripts')
    <script>
        async function fetchLeads() {
            try {
                const res = await fetch("/leads/json", {
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json"
                    }
                });
                const data = await res.json();

                if (!Array.isArray(data.leads)) return;

                const tbody = document.getElementById("lead-table-body");
                tbody.innerHTML = "";

                data.leads.forEach(lead => {
                    const row = document.createElement("tr");
                    row.classList.add("border-t");

                    row.innerHTML = `
                            <td class="px-4 py-2">${lead.ID}</td>
                            <td class="px-4 py-2">${lead.TITLE}</td>
                            <td class="px-4 py-2">${lead.STATUS_ID || 'N/A'}</td>
                            <td class="px-4 py-2">
                                <a href="/leads/${lead.ID}/edit" class="text-blue-500 mr-3">Sửa</a>
                                <form action="/leads/${lead.ID}" method="POST" class="inline-block" onsubmit="return confirm('Xác nhận xóa lead này?')">
                                    <input type="hidden" name="_token" value="{{ csrf_token() }}">
                                    <input type="hidden" name="_method" value="DELETE">
                                    <button type="submit" class="text-red-500">Xóa</button>
                                </form>
                            </td>
                        `;

                    tbody.appendChild(row);
                });
            } catch (err) {
                console.error("Lỗi lấy dữ liệu:", err);
            }
        }

        // Poll every 10 seconds
        setInterval(fetchLeads, 10000);
    </script>
@endpush