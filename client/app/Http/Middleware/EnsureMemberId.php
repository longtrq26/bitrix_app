namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Session;

class EnsureMemberId
{
public function handle($request, Closure $next)
{
if (!Session::has('member_id')) {
return redirect('/login');
}

return $next($request);
}
}