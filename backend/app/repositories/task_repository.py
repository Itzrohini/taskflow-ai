import re
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from app.core.errors import NotFoundError

if TYPE_CHECKING:
    from pymongo.database import Database


class TaskRepository:
    def __init__(self, db: "Database") -> None:
        self.collection = db["tasks"]

    def create(self, document: dict[str, Any]) -> dict[str, Any]:
        stored = dict(document)
        result = self.collection.insert_one(stored)
        stored["_id"] = result.inserted_id
        return self._document_to_dict(stored)

    def get(self, task_id: str) -> dict[str, Any]:
        object_id = self._object_id(task_id)
        document = self.collection.find_one({"_id": object_id})
        if document is None:
            raise NotFoundError("Task not found")
        return self._document_to_dict(document)

    def update(
        self, task_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        object_id = self._object_id(task_id)
        document = self.collection.find_one_and_update(
            {"_id": object_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            raise NotFoundError("Task not found")
        return self._document_to_dict(document)

    def delete(self, task_id: str) -> None:
        object_id = self._object_id(task_id)
        result = self.collection.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise NotFoundError("Task not found")

    def add_subtasks(
        self,
        task_id: str,
        subtasks: list[dict[str, Any]],
        updated_at: datetime,
    ) -> dict[str, Any]:
        object_id = self._object_id(task_id)
        document = self.collection.find_one_and_update(
            {"_id": object_id},
            {
                "$push": {"subtasks": {"$each": subtasks}},
                "$set": {"updated_at": updated_at},
            },
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            raise NotFoundError("Task not found")
        return self._document_to_dict(document)

    def update_subtask(
        self,
        task_id: str,
        subtask_id: str,
        updates: dict[str, Any],
        updated_at: datetime,
    ) -> dict[str, Any]:
        object_id = self._object_id(task_id)
        set_values = {f"subtasks.$.{key}": value for key, value in updates.items()}
        set_values["updated_at"] = updated_at
        document = self.collection.find_one_and_update(
            {"_id": object_id, "subtasks.id": subtask_id},
            {"$set": set_values},
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            self._require_task(object_id)
            raise NotFoundError("Subtask not found")
        return self._document_to_dict(document)

    def delete_subtask(
        self, task_id: str, subtask_id: str, updated_at: datetime
    ) -> dict[str, Any]:
        object_id = self._object_id(task_id)
        document = self.collection.find_one_and_update(
            {"_id": object_id, "subtasks.id": subtask_id},
            {
                "$pull": {"subtasks": {"id": subtask_id}},
                "$set": {"updated_at": updated_at},
            },
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            self._require_task(object_id)
            raise NotFoundError("Subtask not found")
        return self._document_to_dict(document)

    def list(
        self,
        *,
        status: str,
        priority: str | None,
        query: str | None,
        due: str | None,
        today: date,
        sort: str,
        limit: int,
        skip: int,
    ) -> tuple[list[dict[str, Any]], int]:
        filters = self._build_filters(status, priority, query, due, today)
        total = self.collection.count_documents(filters)

        if sort == "due_asc":
            pipeline = [
                {"$match": filters},
                {
                    "$addFields": {
                        "__due_date_missing": {
                            "$eq": [{"$ifNull": ["$due_date", None]}, None]
                        }
                    }
                },
                {"$sort": {"__due_date_missing": ASCENDING, "due_date": ASCENDING}},
                {"$skip": skip},
                {"$limit": limit},
                {"$project": {"__due_date_missing": 0}},
            ]
            documents = self.collection.aggregate(pipeline)
        else:
            documents = (
                self.collection.find(filters)
                .sort("created_at", DESCENDING)
                .skip(skip)
                .limit(limit)
            )
        return [self._document_to_dict(document) for document in documents], total

    def stats(self, today: date) -> dict[str, Any]:
        today_value = today.isoformat()
        pending_filter = {"completed": False}
        return {
            "total": self.collection.count_documents({}),
            "completed": self.collection.count_documents({"completed": True}),
            "pending": self.collection.count_documents(pending_filter),
            "overdue": self.collection.count_documents(
                {"completed": False, "due_date": {"$lt": today_value}}
            ),
            "due_today": self.collection.count_documents(
                {"due_date": today_value}
            ),
            "pending_by_priority": {
                priority: self.collection.count_documents(
                    {"completed": False, "priority": priority}
                )
                for priority in ("low", "medium", "high")
            },
        }

    @staticmethod
    def _build_filters(
        status: str,
        priority: str | None,
        query: str | None,
        due: str | None,
        today: date,
    ) -> dict[str, Any]:
        filters: list[dict[str, Any]] = []
        if status == "pending":
            filters.append({"completed": False})
        elif status == "completed":
            filters.append({"completed": True})

        if priority is not None:
            filters.append({"priority": priority})

        if query:
            literal_query = re.escape(query)
            filters.append(
                {
                    "$or": [
                        {"title": {"$regex": literal_query, "$options": "i"}},
                        {"description": {"$regex": literal_query, "$options": "i"}},
                    ]
                }
            )

        today_value = today.isoformat()
        if due == "today":
            filters.append({"due_date": today_value})
        elif due == "overdue":
            filters.append(
                {"completed": False, "due_date": {"$lt": today_value}}
            )
        elif due == "upcoming":
            filters.append(
                {"completed": False, "due_date": {"$gt": today_value}}
            )
        elif due == "none":
            filters.append(
                {
                    "$or": [
                        {"due_date": None},
                        {"due_date": {"$exists": False}},
                    ]
                }
            )

        if not filters:
            return {}
        if len(filters) == 1:
            return filters[0]
        return {"$and": filters}

    def _require_task(self, object_id: ObjectId) -> None:
        if self.collection.find_one({"_id": object_id}) is None:
            raise NotFoundError("Task not found")

    @staticmethod
    def _object_id(task_id: str) -> ObjectId:
        try:
            return ObjectId(task_id)
        except (InvalidId, TypeError):
            raise NotFoundError("Task not found") from None

    @classmethod
    def _document_to_dict(cls, document: dict[str, Any]) -> dict[str, Any]:
        task = dict(document)
        task["id"] = str(task.pop("_id"))
        if isinstance(task.get("due_date"), str):
            task["due_date"] = date.fromisoformat(task["due_date"])
        task["subtasks"] = [
            cls._normalize_subtask(subtask)
            for subtask in task.get("subtasks", [])
        ]
        for field in ("created_at", "updated_at", "completed_at"):
            if field in task:
                task[field] = cls._normalize_datetime(task[field])
        return task

    @classmethod
    def _normalize_subtask(cls, subtask: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(subtask)
        if "created_at" in normalized:
            normalized["created_at"] = cls._normalize_datetime(
                normalized["created_at"]
            )
        return normalized

    @staticmethod
    def _normalize_datetime(value: Any) -> Any:
        if not isinstance(value, datetime):
            return value
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
