@extends('layouts.app')

@section('content')
    <h1 class="text-2xl font-bold mb-4">Edit Lead</h1>

    <form id="edit-lead-form" action="{{ route('leads.update', $lead['ID']) }}" method="POST" class="space-y-4">
        @csrf
        @method('PATCH')
        <div>
            <label for="TITLE" class="block text-sm font-medium dark:text-white">Title</label>
            <input type="text" name="TITLE" id="TITLE" value="{{ $lead['TITLE'] }}"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
            <span class="error text-red-500 hidden">Title is required if provided</span>
        </div>
        <div>
            <label for="EMAIL" class="block text-sm font-medium dark:text-white">Email</label>
            <input type="email" name="EMAIL" id="EMAIL" value="{{ $lead['EMAIL'] ?? '' }}"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
            <span class="error text-red-500 hidden">Invalid email format</span>
        </div>
        <div>
            <label for="PHONE" class="block text-sm font-medium dark:text-white">Phone</label>
            <input type="text" name="PHONE" id="PHONE" value="{{ $lead['PHONE'] ?? '' }}"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
            <span class="error text-red-500 hidden">Phone is required if provided</span>
        </div>
        <div>
            <label for="STATUS_ID" class="block text-sm font-medium dark:text-white">Status</label>
            <select name="STATUS_ID" id="STATUS_ID" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
                <option value="">Select Status</option>
                <option value="NEW" {{ $lead['STATUS_ID'] === 'NEW' ? 'selected' : '' }}>NEW</option>
                <option value="IN_PROGRESS" {{ $lead['STATUS_ID'] === 'IN_PROGRESS' ? 'selected' : '' }}>IN_PROGRESS</option>
                <option value="CONVERTED" {{ $lead['STATUS_ID'] === 'CONVERTED' ? 'selected' : '' }}>CONVERTED</option>
                <option value="LOST" {{ $lead['STATUS_ID'] === 'LOST' ? 'selected' : '' }}>LOST</option>
            </select>
        </div>
        <div>
            <label for="SOURCE_ID" class="block text-sm font-medium dark:text-white">Source</label>
            <select name="SOURCE_ID" id="SOURCE_ID" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
                <option value="">Select Source</option>
                <option value="WEB" {{ $lead['SOURCE_ID'] === 'WEB' ? 'selected' : '' }}>Web</option>
                <option value="CALL" {{ $lead['SOURCE_ID'] === 'CALL' ? 'selected' : '' }}>Call</option>
            </select>
        </div>
        <div>
            <label for="COMMENTS" class="block text-sm font-medium dark:text-white">Comments</label>
            <textarea name="COMMENTS" id="COMMENTS"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">{{ $lead['COMMENTS'] ?? '' }}</textarea>
        </div>
        <div>
            <label for="domain" class="block text-sm font-medium dark:text-white">Domain</label>
            <input type="text" name="domain" id="domain" value="{{ Session::get('bitrix24_domain') }}"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white" readonly>
            <span class="error text-red-500 hidden">Invalid domain</span>
        </div>
        <button type="submit" class="bg-blue-500 text-white p-2 rounded">Update Lead</button>
    </form>

    <script>
        $('#edit-lead-form').submit(function (e) {
            e.preventDefault();
            $('.error').addClass('hidden');

            const title = $('#TITLE').val();
            const email = $('#EMAIL').val();
            const phone = $('#PHONE').val();
            const domain = $('#domain').val();

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                $('#EMAIL').next('.error').removeClass('hidden');
                return;
            }
            if (phone && !phone.trim()) {
                $('#PHONE').next('.error').removeClass('hidden');
                return;
            }
            if (!/^[a-zA-Z0-9-]+\.bitrix24\.vn$/.test(domain)) {
                $('#domain').next('.error').removeClass('hidden');
                return;
            }

            const data = $(this).serializeArray().reduce((obj, item) => {
                if (item.value) obj[item.name] = item.value;
                return obj;
            }, {});
            if (Object.keys(data).length === 0) {
                Toastify({
                    text: 'At least one field must be provided',
                    duration: 3000,
                    backgroundColor: '#EF4444',
                }).showToast();
                return;
            }

            $(this).find('button[type="submit"]').prop('disabled', true).text('Updating...');
            $.ajax({
                url: $(this).attr('action'),
                method: 'PATCH',
                data: data,
                success: function () {
                    Toastify({
                        text: 'Lead updated successfully',
                        duration: 3000,
                        backgroundColor: '#10B981',
                    }).showToast();
                    window.location.href = '{{ route('leads.index') }}';
                },
                error: function (xhr) {
                    const message = xhr.responseJSON?.message || 'Failed to update lead';
                    Toastify({
                        text: message,
                        duration: 3000,
                        backgroundColor: '#EF4444',
                    }).showToast();
                    $(this).find('button[type="submit"]').prop('disabled', false).text('Update Lead');
                }
            });
        });
    </script>
@endsection