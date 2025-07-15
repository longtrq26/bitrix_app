@extends('layouts.app')

@section('content')
    <div class="container mx-auto">
        <form method="GET" action="/leads" class="mb-4">
            <input name="search" class="p-2 border" placeholder="Tìm kiếm...">
            <select name="status" class="p-2 border">
                <option value="">Tất cả</option>
                <option value="NEW">New</option>
                <option value="CONVERTED">Converted</option>
            </select>
            <button type="submit" class="bg-blue-500 text-white px-4 py-2">Lọc</button>
        </form>

        <table class="table-auto w-full">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($leads as $lead)
                    <tr>
                        <td>{{ $lead['ID'] }}</td>
                        <td>{{ $lead['TITLE'] }}</td>
                        <td>{{ $lead['STATUS_ID'] }}</td>
                        <td>
                            <a href="/leads/{{ $lead['ID'] }}/edit" class="text-blue-500">Sửa</a>
                            <form action="/leads/{{ $lead['ID'] }}" method="POST"
                                onsubmit="return confirm('Bạn có chắc muốn xóa?')" style="display:inline;">
                                @csrf
                                @method('DELETE')
                                <button class="text-red-500">Xoá</button>
                            </form>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endsection