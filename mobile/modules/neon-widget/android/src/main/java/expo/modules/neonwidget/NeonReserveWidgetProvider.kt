package expo.modules.neonwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.SweepGradient
import android.net.Uri
import android.widget.RemoteViews
import kotlin.math.min

class NeonReserveWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    updateAll(context, manager, ids)
  }

  companion object {
    const val PREFS = "neon_reserve_widget"

    fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val prefs = context.getSharedPreferences(PREFS, 0)
      ids.forEach { id ->
        val views = RemoteViews(context.packageName, R.layout.neon_reserve_widget)
        views.setTextViewText(R.id.widget_title, prefs.getString("title", "Keep this week"))
        views.setTextViewText(R.id.widget_message, prefs.getString("message", "Your next promise is waiting"))
        views.setImageViewBitmap(
          R.id.widget_rings,
          drawRings(
            context,
            prefs.getFloat("consistency", 0.72f),
            prefs.getFloat("goal", 0.42f),
            prefs.getFloat("circle", 0.58f),
          ),
        )
        val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse("keptseeker://")).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        views.setOnClickPendingIntent(
          R.id.widget_root,
          PendingIntent.getActivity(context, id, launchIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
        )
        manager.updateAppWidget(id, views)
      }
    }

    /**
     * The same three rings the app draws, in the same order and the same colours.
     *
     * Order is promise → goal → circle from the outside in, matching `Rings` in
     * `features/progress/rings.tsx`; the old widget drew goal and circle the
     * other way round, so the same week looked like two different weeks
     * depending on where you read it.
     *
     * Geometry is taken from the app's proportions rather than fixed dp, so the
     * stack keeps its shape at any bitmap size. Each track is its own ring's hue
     * at low luminance — a single grey track makes an empty ring read as a dead
     * slot rather than as nothing done yet.
     */
    private fun drawRings(context: Context, promise: Float, goal: Float, circle: Float): Bitmap {
      val density = context.resources.displayMetrics.density
      val size = (126 * density).toInt()
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val center = size / 2f
      val width = size * 0.105f
      val gap = size * 0.028f

      val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = width
        strokeCap = Paint.Cap.ROUND
      }
      val progress = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = width
        strokeCap = Paint.Cap.ROUND
      }
      // `Context.getColor` resolves `values-night` on its own, so the rings follow
      // the launcher's theme without a second code path. API 23+; Expo's floor is higher.
      val color = { id: Int -> context.getColor(id) }

      val rings = listOf(
        Triple(promise, R.color.kept_track_promise, R.color.kept_ring_promise_from to R.color.kept_ring_promise_to),
        Triple(goal, R.color.kept_track_goal, R.color.kept_ring_goal_from to R.color.kept_ring_goal_to),
        Triple(circle, R.color.kept_track_circle, R.color.kept_ring_circle_from to R.color.kept_ring_circle_to),
      )

      rings.forEachIndexed { index, (rawValue, trackColor, stops) ->
        val radius = center - width / 2 - index * (width + gap)
        val rect = RectF(center - radius, center - radius, center + radius, center + radius)
        track.color = color(trackColor)
        canvas.drawArc(rect, -90f, 360f, false, track)

        // A sweep gradient is a conic gradient, which is what the app fakes with
        // segmented arcs — but it starts at 3 o'clock, so rotate it to the 12
        // o'clock start the arc uses.
        progress.shader = SweepGradient(
          center,
          center,
          intArrayOf(color(stops.first), color(stops.second)),
          floatArrayOf(0f, 1f),
        ).apply {
          setLocalMatrix(Matrix().apply { setRotate(-90f, center, center) })
        }
        canvas.drawArc(rect, -90f, 360f * min(1f, rawValue.coerceAtLeast(0f)), false, progress)
      }
      return bitmap
    }
  }
}
