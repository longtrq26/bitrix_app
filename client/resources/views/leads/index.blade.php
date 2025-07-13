<x-layout>
    <h1 class="text-xl font-bold mb-4">Danh sách Leads</h1>

    <a href="{{ route('leads.create') }}" class="bg-blue-500 text-white px-4 py-2 rounded">+ Thêm Lead</a>

    <table class="w-full mt-4 table-auto border-collapse">
        <thead>
            <tr class="bg-gray-100">
                <th class="border p-2">ID</th>
                <th class="border p-2">Tiêu đề</th>
                <th class="border p-2">Ngày tạo</th>
                <th class="border p-2">Hành động</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($leads as $lead)
                <tr>
                    <td class="border p-2">{{ $lead['ID'] }}</td>
                    <td class="border p-2">{{ $lead['TITLE'] }}</td>
                    <td class="border p-2">{{ $lead['DATE_CREATE'] }}</td>
                    <td class="border p-2">
                        <form method="POST" action="{{ route('leads.destroy', $lead['ID']) }}">
                            @csrf
                            @method('DELETE')
                            <button class="text-red-600 hover:underline">Xóa</button>
                        </form>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</x-layout>